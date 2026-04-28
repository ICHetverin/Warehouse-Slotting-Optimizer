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
