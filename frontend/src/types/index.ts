// ── Warehouses / catalog ──────────────────────────────────────────────────────

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

export interface WarehouseCreateRequest {
  name: string;
  rows: number;
  columns: number;
  dockX: number;
  dockY: number;
  aisleWidthM?: number;
}

export interface Sku {
  id: number;
  code: string;
  name: string;
  weightKg: number;
  volumeM3: number | null;
  category: string | null;
  createdAt: string;
}

export interface Slot {
  id: number;
  label: string;
  row: number;
  col: number;
  level: number;
  zone: string | null;
  capacityKg: number;
  volumeM3: number | null;
  currentSkuId: number | null;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface ScoringWeights {
  w1: number;
  w2: number;
  w3: number;
  decayLambda?: number;
  useAbcXyz?: boolean;
}

export interface ScoringConstraints {
  familyToZone?: Record<string, string>;
  enableFamilyGrouping?: boolean;
  maxAClassPerZone?: number;
  familyAffinityWeight?: number;
  congestionPenalty?: number;
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

export interface ScoringValidation {
  forecastMape: number;
  forecastWape: number;
  placementStabilityPct: number;
  routeEfficiencyGainPct: number;
  routeEfficiencyCiLowPct: number;
  routeEfficiencyCiHighPct: number;
  detail: Record<string, number>;
}

export interface ScoringRunResponse {
  jobId: string;
  warehouseId: number;
  weightsUsed: ScoringWeights;
  velocityDays: number;
  totalAssignments: number;
  improved: number;
  assignments: Assignment[];
  validation: ScoringValidation | null;
  computedAt: string;
}

export interface ScoringRunRequest {
  warehouseId: number;
  weights?: ScoringWeights;
  velocityDays?: number;
  constraints?: ScoringConstraints;
}

export interface CopickMatrixResponse {
  warehouseId: number;
  velocityDays: number;
  skuCount: number;
  pairCount: number;
  matrix: Record<string, Record<string, number>>;
}

export interface AbcXyzProfile {
  skuId: number;
  skuCode: string;
  abcClass: string;
  xyzClass: string;
  velocityScore: number;
  stabilityCv: number;
  pickCount: number;
}

export interface AbcXyzMatrixResponse {
  warehouseId: number;
  totalSkus: number;
  matrix: Record<string, Record<string, number>>;
  profiles: AbcXyzProfile[];
}

// ── Simulation / tuning ───────────────────────────────────────────────────────

export interface SimulationRequest {
  warehouseId: number;
  proposedAssignments?: Record<number, number>;
  sampleSize?: number;
}

export interface SimulationResult {
  warehouseId: number;
  ordersSampled: number;
  totalPicks: number;
  avgBeforeDistanceM: number;
  avgAfterDistanceM: number;
  savingsM: number;
  savingsPct: number;
  totalBeforeDistanceM: number;
  totalAfterDistanceM: number;
  totalBeforeTime: string;
  totalAfterTime: string;
  improvedOrders: number;
  sameOrders: number;
  worsenedOrders: number;
}

export interface TuningRequest {
  warehouseId: number;
  gridStep?: number;
  metricToOpt?: string;
  sampleDays?: number;
}

export interface TuningGridPoint {
  w1: number;
  w2: number;
  w3: number;
  metric: number;
}

export interface TuningResult {
  warehouseId: number;
  bestWeights: ScoringWeights;
  bestMetricValue: number;
  metricName: string;
  gridStep: number;
  evaluations: number;
  scoreGrid: TuningGridPoint[];
  baselineValue: number;
  improvementPct: number;
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
  weightM: number;
}

export interface WarehouseGraphResponse {
  warehouseId: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Recommendations ───────────────────────────────────────────────────────────

export interface ExplanationReason {
  type: 'velocity' | 'copick' | 'distance' | 'weight_fit' | 'physical_fit' | 'general';
  description: string;
  value: number;
  detail: Record<string, unknown>;
}

export interface ExplanationImpact {
  avgRouteSavingsM: number;
  dailyPicksAffected: number;
  estimatedDailySavingsMin: number;
  savingsCiLowM?: number | null;
  savingsCiHighM?: number | null;
}

export interface ExplanationDetail {
  skuCode: string;
  fromSlot: string;
  toSlot: string;
  scoreBefore: number;
  scoreAfter: number;
  reasons: ExplanationReason[];
  impact: ExplanationImpact;
  pValue?: number | null;
  qValue?: number | null;
  liftMax?: number | null;
  significant?: boolean | null;
}

export interface BulkAcceptResult {
  applied: number;
  skipped: number;
  total: number;
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
  decidedAt?: string | null;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export type StorageStrategy = 'RANDOM' | 'CLASS_BASED' | 'DEDICATED' | 'HYBRID';

export interface UploadResult {
  imported: number;
}

export interface DatasetInfo {
  key: string;
  title: string;
  source: string;
  description: string;
  hasStrategies: boolean;
  realLayout: boolean;
}

export interface MendeleyImportResult {
  warehouseId: number;
  skuCount: number;
  slotCount: number;
  assignedSlotCount: number;
  orderCount: number;
  orderLineCount: number;
  strategy: StorageStrategy;
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    version: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  timestamp?: string;
}
