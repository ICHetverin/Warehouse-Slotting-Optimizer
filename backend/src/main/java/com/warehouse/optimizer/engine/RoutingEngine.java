package com.warehouse.optimizer.engine;

import com.warehouse.optimizer.dto.Route;
import com.warehouse.optimizer.dto.RouteComparison;
import com.warehouse.optimizer.model.Slot;
import com.warehouse.optimizer.model.Warehouse;
import lombok.extern.slf4j.Slf4j;
import org.jgrapht.Graph;
import org.jgrapht.GraphPath;
import org.jgrapht.alg.shortestpath.DijkstraShortestPath;
import org.jgrapht.graph.DefaultWeightedEdge;
import org.jgrapht.graph.SimpleWeightedGraph;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class RoutingEngine {

    /** Virtual node ID for the dock. All real slot IDs are positive. */
    public static final long DOCK_NODE_ID = 0L;

    // ──────────────────────────────────────────────────────────────────────────
    // Graph construction
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Builds a weighted undirected graph of the warehouse.
     * <ul>
     *   <li>One node per slot + one virtual dock node (DOCK_NODE_ID = 0).</li>
     *   <li>4-connectivity: adjacent slots (row/col ±1) are connected with
     *       weight = aisle_width_m.</li>
     *   <li>Dock connects to the slot at its (dockX, dockY) position,
     *       or to the nearest slot if that cell is empty.</li>
     * </ul>
     */
    public Graph<Long, DefaultWeightedEdge> buildWarehouseGraph(Warehouse warehouse, List<Slot> slots) {
        SimpleWeightedGraph<Long, DefaultWeightedEdge> graph =
                new SimpleWeightedGraph<>(DefaultWeightedEdge.class);

        double stepM = warehouse.getAisleWidthM().doubleValue();

        graph.addVertex(DOCK_NODE_ID);

        Map<String, Long> posMap = new HashMap<>(slots.size() * 2);
        for (Slot slot : slots) {
            graph.addVertex(slot.getId());
            posMap.put(posKey(slot.getRow(), slot.getCol()), slot.getId());
        }

        for (Slot slot : slots) {
            Long right = posMap.get(posKey(slot.getRow(), slot.getCol() + 1));
            Long down  = posMap.get(posKey(slot.getRow() + 1, slot.getCol()));
            if (right != null) addWeightedEdge(graph, slot.getId(), right, stepM);
            if (down  != null) addWeightedEdge(graph, slot.getId(), down,  stepM);
        }

        // Connect dock
        int dockRow = warehouse.getDockX();
        int dockCol = warehouse.getDockY();
        Long exactDockSlot = posMap.get(posKey(dockRow, dockCol));
        if (exactDockSlot != null) {
            addWeightedEdge(graph, DOCK_NODE_ID, exactDockSlot, 0.0);
        } else if (!slots.isEmpty()) {
            slots.stream()
                    .min(Comparator.comparingInt(
                            s -> Math.abs(s.getRow() - dockRow) + Math.abs(s.getCol() - dockCol)))
                    .ifPresent(nearest -> {
                        double d = (Math.abs(nearest.getRow() - dockRow)
                                  + Math.abs(nearest.getCol() - dockCol)) * stepM;
                        addWeightedEdge(graph, DOCK_NODE_ID, nearest.getId(), d);
                    });
        }

        log.debug("Graph built: {} nodes, {} edges, warehouse={}",
                graph.vertexSet().size(), graph.edgeSet().size(), warehouse.getId());
        return graph;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Shortest path
    // ──────────────────────────────────────────────────────────────────────────

    public record PathResult(List<Long> nodes, double distanceM) {
        public static PathResult empty(long from, long to) {
            return new PathResult(List.of(from, to), Double.MAX_VALUE / 2);
        }
    }

    public PathResult findShortestPath(
            Graph<Long, DefaultWeightedEdge> graph, Long start, Long end) {
        GraphPath<Long, DefaultWeightedEdge> path =
                new DijkstraShortestPath<>(graph).getPath(start, end);
        if (path == null) return PathResult.empty(start, end);
        return new PathResult(path.getVertexList(), path.getWeight());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Route optimisation
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Optimises the pick route for a list of slot IDs.
     *
     * <p>Trip splitting: if {@code cartCapacityKg > 0}, items are grouped into
     * trips so no trip exceeds the cart capacity. Within each trip, the order is
     * determined by exact TSP (≤ 10 items) or nearest-neighbour + 2-opt (> 10).
     *
     * @param itemWeightsBySlot weight of the item at each slot (for trip splitting)
     * @param cartCapacityKg    0 = no capacity constraint
     */
    public Route optimizePickRoute(
            Graph<Long, DefaultWeightedEdge> graph,
            Long dockNode,
            List<Long> pickSlotIds,
            Map<Long, Double> itemWeightsBySlot,
            double cartCapacityKg) {

        if (pickSlotIds.isEmpty()) return new Route(List.of(), 0.0, 0, List.of());

        List<List<Long>> trips = splitIntoTrips(pickSlotIds, itemWeightsBySlot, cartCapacityKg);
        DijkstraShortestPath<Long, DefaultWeightedEdge> dijkstra = new DijkstraShortestPath<>(graph);

        double totalDist = 0;
        List<Long> orderedSlots = new ArrayList<>();
        List<Long> fullPath     = new ArrayList<>();
        fullPath.add(dockNode);

        for (List<Long> trip : trips) {
            if (trip.isEmpty()) continue;

            // Build local node list: index 0 = dock, indices 1..k = pick slots
            List<Long> nodes = new ArrayList<>(trip.size() + 1);
            nodes.add(dockNode);
            nodes.addAll(trip);
            int n = nodes.size();

            // Pre-compute pairwise shortest-path distances and vertex lists
            double[][]   dist  = new double[n][n];
            List<Long>[][] paths = new List[n][n];

            for (int i = 0; i < n; i++) {
                for (int j = i + 1; j < n; j++) {
                    GraphPath<Long, DefaultWeightedEdge> p =
                            dijkstra.getPath(nodes.get(i), nodes.get(j));
                    if (p != null) {
                        dist[i][j]  = dist[j][i]  = p.getWeight();
                        paths[i][j] = paths[j][i] = p.getVertexList();
                    } else {
                        dist[i][j]  = dist[j][i]  = Double.MAX_VALUE / 2;
                        paths[i][j] = paths[j][i] = List.of(nodes.get(i), nodes.get(j));
                    }
                }
            }

            // Solve TSP for pick nodes (indices 1..n-1)
            int numPicks = n - 1;
            List<Integer> tourIndices = numPicks <= 10
                    ? exactTsp(numPicks, dist)
                    : nearestNeighborTsp(numPicks, dist);

            // Assemble route: dock → pick1 → ... → pickK → dock
            int prev = 0;
            for (int idx : tourIndices) {
                totalDist += dist[prev][idx];
                appendPath(fullPath, paths[prev][idx]);
                orderedSlots.add(nodes.get(idx));
                prev = idx;
            }
            totalDist += dist[prev][0];
            appendPath(fullPath, paths[prev][0]);
        }

        return new Route(orderedSlots, totalDist, trips.size(), fullPath);
    }

    /**
     * Computes before/after route comparison for the same pick list in two
     * slot arrangements.
     *
     * @param currentPickSlotIds  slot IDs under the current arrangement
     * @param proposedPickSlotIds slot IDs under the proposed arrangement
     */
    public RouteComparison compareRoutes(
            Graph<Long, DefaultWeightedEdge> graph,
            Long dockNode,
            List<Long> currentPickSlotIds,
            List<Long> proposedPickSlotIds,
            Map<Long, Double> itemWeightsBySlot,
            double cartCapacityKg) {

        Route current  = optimizePickRoute(graph, dockNode, currentPickSlotIds, itemWeightsBySlot, cartCapacityKg);
        Route proposed = optimizePickRoute(graph, dockNode, proposedPickSlotIds, itemWeightsBySlot, cartCapacityKg);

        double savingsM   = current.totalDistanceM() - proposed.totalDistanceM();
        double savingsPct = current.totalDistanceM() > 0
                ? savingsM / current.totalDistanceM() * 100.0
                : 0.0;

        return new RouteComparison(
                current.totalDistanceM(), proposed.totalDistanceM(),
                savingsM, savingsPct, current, proposed);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // TSP solvers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Exact TSP via permutation enumeration.
     * dist[0] = dock, dist[1..n] = pick nodes. Returns visit order as indices into dist.
     */
    private List<Integer> exactTsp(int numPicks, double[][] dist) {
        int[] perm = new int[numPicks];
        for (int i = 0; i < numPicks; i++) perm[i] = i + 1;

        double bestDist  = Double.MAX_VALUE;
        int[]  bestPerm  = perm.clone();

        do {
            double d = dist[0][perm[0]];
            for (int i = 0; i < numPicks - 1; i++) d += dist[perm[i]][perm[i + 1]];
            d += dist[perm[numPicks - 1]][0];

            if (d < bestDist) {
                bestDist = d;
                bestPerm = perm.clone();
            }
        } while (nextPermutation(perm));

        List<Integer> result = new ArrayList<>(numPicks);
        for (int idx : bestPerm) result.add(idx);
        return result;
    }

    /** Nearest-neighbour heuristic followed by 2-opt improvement. */
    private List<Integer> nearestNeighborTsp(int numPicks, double[][] dist) {
        boolean[] visited = new boolean[numPicks + 1];
        visited[0] = true;
        List<Integer> tour = new ArrayList<>(numPicks);
        int current = 0;

        for (int step = 0; step < numPicks; step++) {
            double best = Double.MAX_VALUE;
            int next = -1;
            for (int j = 1; j <= numPicks; j++) {
                if (!visited[j] && dist[current][j] < best) {
                    best = dist[current][j];
                    next = j;
                }
            }
            visited[next] = true;
            tour.add(next);
            current = next;
        }

        return twoOpt(tour, numPicks, dist);
    }

    /**
     * 2-opt improvement: repeatedly reverse sub-segments while the tour shortens.
     * Operates on a tour of pick-node indices (0-indexed list, values are 1..numPicks).
     */
    private List<Integer> twoOpt(List<Integer> tour, int numPicks, double[][] dist) {
        List<Integer> best = new ArrayList<>(tour);
        boolean improved = true;

        while (improved) {
            improved = false;
            for (int i = 0; i < numPicks - 1 && !improved; i++) {
                for (int j = i + 2; j < numPicks; j++) {
                    int a = best.get(i);
                    int b = best.get(i + 1);
                    int c = best.get(j);
                    int d = (j + 1 < numPicks) ? best.get(j + 1) : 0;

                    double gain = (dist[a][b] + dist[c][d]) - (dist[a][c] + dist[b][d]);
                    if (gain > 1e-10) {
                        Collections.reverse(best.subList(i + 1, j + 1));
                        improved = true;
                        break;
                    }
                }
            }
        }

        return best;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /** Greedy trip splitting by cart capacity. Returns [{slotIds for trip 1}, ...]. */
    private List<List<Long>> splitIntoTrips(
            List<Long> pickSlotIds,
            Map<Long, Double> itemWeights,
            double cartCapacityKg) {

        if (cartCapacityKg <= 0) {
            return List.of(new ArrayList<>(pickSlotIds));
        }

        List<List<Long>> trips = new ArrayList<>();
        List<Long> current = new ArrayList<>();
        double load = 0;

        for (Long slotId : pickSlotIds) {
            double w = itemWeights.getOrDefault(slotId, 0.0);
            if (!current.isEmpty() && load + w > cartCapacityKg) {
                trips.add(current);
                current = new ArrayList<>();
                load = 0;
            }
            current.add(slotId);
            load += w;
        }
        if (!current.isEmpty()) trips.add(current);
        if (trips.isEmpty()) trips.add(List.of());

        return trips;
    }

    /** Appends {@code segment} to {@code path}, skipping the first node to avoid duplicates. */
    private static void appendPath(List<Long> path, List<Long> segment) {
        if (segment == null || segment.isEmpty()) return;
        int start = path.isEmpty() ? 0 : 1;
        for (int i = start; i < segment.size(); i++) path.add(segment.get(i));
    }

    private static void addWeightedEdge(
            SimpleWeightedGraph<Long, DefaultWeightedEdge> graph, Long u, Long v, double weight) {
        DefaultWeightedEdge e = graph.addEdge(u, v);
        if (e != null) graph.setEdgeWeight(e, weight);
    }

    private static String posKey(int row, int col) {
        return row + "," + col;
    }

    /** Generates next lexicographic permutation in-place. Returns false when exhausted. */
    static boolean nextPermutation(int[] arr) {
        int n = arr.length;
        int i = n - 2;
        while (i >= 0 && arr[i] >= arr[i + 1]) i--;
        if (i < 0) return false;

        int j = n - 1;
        while (arr[j] <= arr[i]) j--;

        int tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;

        for (int lo = i + 1, hi = n - 1; lo < hi; lo++, hi--) {
            tmp = arr[lo]; arr[lo] = arr[hi]; arr[hi] = tmp;
        }
        return true;
    }
}
