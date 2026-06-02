export interface DemoSeedResponse {
  warehouseId: number;
  message: string;
}

export interface Warehouse {
  id: number;
  name: string;
  rows: number;
  columns: number;
  dockX: number;
  dockY: number;
  aisleWidthM: number;
  createdAt: string;
}

export interface ScoringWeights {
  w1: number;
  w2: number;
  w3: number;
}

export interface Assignment {
  skuId: number;
  skuCode: string;
  fromSlotId: number | null;
  fromLabel: string | null;
  toSlotId: number;
  toLabel: string;
  score: number;
  scoreDelta: number;
}

export interface ScoringRunResponse {
  jobId: string;
  warehouseId: number;
  weightsUsed: ScoringWeights;
  velocityDays: number;
  totalAssignments: number;
  improved: number;
  assignments: Assignment[];
  computedAt: string;
}

export interface CopickMatrixResponse {
  warehouseId: number;
  days: number;
  skuCount: number;
  pairCount: number;
  matrix: Record<string, Record<string, number>>;
}

// ── Routing ───────────────────────────────────────────────────────────────────

export interface Route {
  orderedSlotIds: number[];
  totalDistanceM: number;
  tripCount: number;
  fullPath: number[];
}

export interface RouteComparison {
  currentDistanceM: number;
  proposedDistanceM: number;
  savingsM: number;
  savingsPct: number;
  currentRoute: Route;
  proposedRoute: Route;
}

export interface GraphNode {
  id: number;
  label: string;
  row: number;
  col: number;
  isDock: boolean;
}

export interface GraphEdge {
  source: number;
  target: number;
  weight: number;
}

export interface WarehouseGraphResponse {
  warehouseId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Recommendations / Phase 3 ─────────────────────────────────────────────────

export interface ExplanationReason {
  type: 'velocity' | 'copick' | 'distance' | 'weight_fit' | 'general';
  description: string;
  value: number;
  detail: Record<string, unknown>;
}

export interface ExplanationImpact {
  avgRouteSavingsM: number;
  dailyPicksAffected: number;
  estimatedDailySavingsMin: number;
}

export interface ExplanationDetail {
  skuCode: string;
  fromSlot: string;
  toSlot: string;
  scoreBefore: number;
  scoreAfter: number;
  reasons: ExplanationReason[];
  impact: ExplanationImpact;
}

export interface RecommendationResponse {
  id: number;
  warehouseId: number;
  skuId: number;
  skuCode: string;
  fromSlot: string | null;
  toSlot: string;
  scoreDelta: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  explanation: ExplanationDetail | null;
  createdAt: string;
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
}

export interface UploadResult {
  imported: number;
}
