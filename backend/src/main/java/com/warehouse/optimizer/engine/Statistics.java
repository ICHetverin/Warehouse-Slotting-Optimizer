package com.warehouse.optimizer.engine;

import org.apache.commons.math3.distribution.ChiSquaredDistribution;
import org.apache.commons.math3.distribution.NormalDistribution;

import java.util.Arrays;
import java.util.Random;

/**
 * Small statistics toolkit used to make slotting recommendations statistically
 * defensible rather than raw top-N heuristics. Pure, side-effect-free functions.
 *
 * References:
 *  - Association lift & chi-square significance (market-basket analysis)
 *  - Wilson score interval for binomial proportions (stable for rare events)
 *  - Benjamini-Hochberg FDR control for multiple comparisons
 *  - Percentile bootstrap confidence intervals
 */
public final class Statistics {

    private Statistics() {}

    /** z for a two-sided 95% interval. */
    public static final double Z_95 = 1.959963984540054;

    // ── Association strength (co-pick) ─────────────────────────────────────────

    /**
     * Lift of the pair (X,Y): how many times more often X and Y co-occur than
     * expected under independence. lift = P(X∩Y) / (P(X)·P(Y)).
     * &gt;1 positive association, =1 independent, &lt;1 negative.
     *
     * @param pairCount orders containing both X and Y
     * @param cntX      orders containing X
     * @param cntY      orders containing Y
     * @param n         total orders
     */
    public static double lift(double pairCount, double cntX, double cntY, double n) {
        if (cntX <= 0 || cntY <= 0 || n <= 0) return 0.0;
        double pXY = pairCount / n;
        double pX = cntX / n;
        double pY = cntY / n;
        double denom = pX * pY;
        return denom > 0 ? pXY / denom : 0.0;
    }

    /**
     * Two-sided p-value for the 2×2 contingency table of co-occurrence
     * (Pearson chi-square, 1 df). Low p ⇒ the association is unlikely by chance.
     *
     * Cells: a = both, b = X only, c = Y only, d = neither.
     */
    public static double chiSquarePValue(double pairCount, double cntX, double cntY, double n) {
        double a = pairCount;
        double b = cntX - pairCount;
        double c = cntY - pairCount;
        double d = n - cntX - cntY + pairCount;
        if (a < 0 || b < 0 || c < 0 || d < 0) return 1.0;
        double rowsCols = (a + b) * (c + d) * (a + c) * (b + d);
        if (rowsCols <= 0) return 1.0;
        double diff = (a * d - b * c);
        double chi = (n * diff * diff) / rowsCols;
        if (chi <= 0) return 1.0;
        return 1.0 - new ChiSquaredDistribution(1).cumulativeProbability(chi);
    }

    // ── Wilson score interval (binomial proportion) ────────────────────────────

    /**
     * Lower bound of the Wilson score interval for a proportion p̂ = successes/n.
     * Shrinks noisy estimates from rare events toward 0, so a SKU seen in a
     * handful of orders is not over-credited. Always in [0,1].
     */
    public static double wilsonLowerBound(double successes, double n, double z) {
        if (n <= 0) return 0.0;
        double pHat = successes / n;
        double z2 = z * z;
        double denom = 1.0 + z2 / n;
        double centre = (pHat + z2 / (2 * n)) / denom;
        double margin = (z / denom) * Math.sqrt(pHat * (1 - pHat) / n + z2 / (4 * n * n));
        return Math.max(0.0, centre - margin);
    }

    public static double wilsonLowerBound(double successes, double n) {
        return wilsonLowerBound(successes, n, Z_95);
    }

    /** Wilson score interval [low, high] for p̂ = successes/n. */
    public static double[] wilsonInterval(double successes, double n, double z) {
        if (n <= 0) return new double[]{0, 0};
        double pHat = successes / n;
        double z2 = z * z;
        double denom = 1.0 + z2 / n;
        double centre = (pHat + z2 / (2 * n)) / denom;
        double margin = (z / denom) * Math.sqrt(pHat * (1 - pHat) / n + z2 / (4 * n * n));
        return new double[]{Math.max(0.0, centre - margin), Math.min(1.0, centre + margin)};
    }

    private static final NormalDistribution STD_NORMAL = new NormalDistribution();

    /**
     * One-sided upper-tail p-value of a z-score: P(Z &gt; z). Used to test whether a
     * SKU's order share is significantly above a baseline expectation.
     */
    public static double normalUpperTailP(double z) {
        return 1.0 - STD_NORMAL.cumulativeProbability(z);
    }

    // ── Benjamini-Hochberg false discovery rate ────────────────────────────────

    /**
     * Result of a BH-FDR procedure: which hypotheses are significant and their
     * adjusted q-values (BH-adjusted p-values), aligned to the input order.
     */
    public record FdrResult(boolean[] significant, double[] qValues, double threshold) {}

    /**
     * Benjamini-Hochberg procedure controlling the false discovery rate at {@code q}.
     * Returns, per input p-value: whether it is significant, its adjusted q-value,
     * and the largest p-value that passed (threshold; 0 if none).
     *
     * This is what makes the recommendation set statistically distinguished and of
     * *variable* size: only discoveries that survive FDR control are surfaced.
     */
    public static FdrResult benjaminiHochberg(double[] pValues, double q) {
        int m = pValues.length;
        boolean[] sig = new boolean[m];
        double[] qv = new double[m];
        if (m == 0) return new FdrResult(sig, qv, 0.0);

        Integer[] order = new Integer[m];
        for (int i = 0; i < m; i++) order[i] = i;
        Arrays.sort(order, (i, j) -> Double.compare(pValues[i], pValues[j]));

        // largest k (1-based) with p_(k) <= (k/m)·q
        int maxK = 0;
        for (int rank = 1; rank <= m; rank++) {
            double p = pValues[order[rank - 1]];
            if (p <= (rank / (double) m) * q) maxK = rank;
        }
        double threshold = maxK > 0 ? pValues[order[maxK - 1]] : 0.0;

        // adjusted q-values: q_(k) = min over r>=k of (m/r)·p_(r), monotone, clamped to 1
        double running = 1.0;
        for (int rank = m; rank >= 1; rank--) {
            int idx = order[rank - 1];
            double adj = Math.min(1.0, (m / (double) rank) * pValues[idx]);
            running = Math.min(running, adj);
            qv[idx] = running;
            sig[idx] = rank <= maxK;
        }
        return new FdrResult(sig, qv, threshold);
    }

    // ── Percentile bootstrap confidence interval ───────────────────────────────

    /** A confidence interval [low, high] around a point estimate. */
    public record CI(double low, double high, double point) {}

    /**
     * Percentile bootstrap CI for the mean of {@code sample}. Resamples with
     * replacement {@code iterations} times and takes the alpha/2 and 1-alpha/2
     * percentiles of the bootstrap means. Deterministic for a given {@code rng}.
     *
     * Used for a defensible "guaranteed" travel-distance saving: if the lower
     * bound stays above 0, the saving is unlikely to be noise.
     */
    public static CI percentileBootstrapMeanCI(double[] sample, int iterations, double alpha, Random rng) {
        int n = sample.length;
        if (n == 0) return new CI(0, 0, 0);
        double point = mean(sample);
        if (n == 1) return new CI(sample[0], sample[0], point);

        double[] means = new double[iterations];
        for (int b = 0; b < iterations; b++) {
            double sum = 0;
            for (int i = 0; i < n; i++) sum += sample[rng.nextInt(n)];
            means[b] = sum / n;
        }
        Arrays.sort(means);
        double low = percentile(means, alpha / 2.0);
        double high = percentile(means, 1.0 - alpha / 2.0);
        return new CI(low, high, point);
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    public static double mean(double[] xs) {
        if (xs.length == 0) return 0.0;
        double s = 0;
        for (double x : xs) s += x;
        return s / xs.length;
    }

    /** Linear-interpolation percentile of a *sorted* array; p in [0,1]. */
    public static double percentile(double[] sorted, double p) {
        int n = sorted.length;
        if (n == 0) return 0.0;
        if (n == 1) return sorted[0];
        double rank = p * (n - 1);
        int lo = (int) Math.floor(rank);
        int hi = (int) Math.ceil(rank);
        if (lo == hi) return sorted[lo];
        double frac = rank - lo;
        return sorted[lo] * (1 - frac) + sorted[hi] * frac;
    }
}
