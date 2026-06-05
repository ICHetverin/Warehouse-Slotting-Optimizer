import axios, { AxiosError } from 'axios';
import type {
  ApiResponse,
  Warehouse,
  WarehouseCreateRequest,
  Sku,
  Slot,
  ScoringRunRequest,
  ScoringRunResponse,
  ScoringWeights,
  UploadResult,
  MendeleyImportResult,
  DatasetInfo,
  StorageStrategy,
  CopickMatrixResponse,
  AbcXyzMatrixResponse,
  SimulationRequest,
  SimulationResult,
  TuningRequest,
  TuningResult,
  WarehouseGraphResponse,
  Route,
  RouteComparison,
  RecommendationResponse,
  BulkAcceptResult,
} from '../types';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 120_000,
});

/**
 * Normalize backend errors ({ error: { code, message } }) into a plain
 * Error whose message is human-readable, so every caller can just show
 * `err.message`. Network/timeout failures get friendly fallbacks.
 */
http.interceptors.response.use(
  r => r,
  (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    let message = 'Что-то пошло не так. Попробуйте ещё раз.';
    if (error.response) {
      message =
        error.response.data?.error?.message ??
        `Ошибка сервера (${error.response.status}).`;
    } else if (error.code === 'ECONNABORTED') {
      message = 'Превышено время ожидания. Операция могла оказаться слишком долгой.';
    } else if (error.request) {
      message = 'Не удаётся связаться с сервером. Бэкенд запущен на :8080?';
    }
    const normalized = new Error(message);
    normalized.name = error.response?.data?.error?.code ?? 'ApiError';
    return Promise.reject(normalized);
  },
);

const unwrap = <T>(p: Promise<{ data: ApiResponse<T> }>): Promise<T> =>
  p.then(r => r.data.data);

const uploadForm = (file: File): FormData => {
  const form = new FormData();
  form.append('file', file);
  return form;
};

export const api = {
  // ── Health ───────────────────────────────────────────────────────────────
  health: () => unwrap<{ status: string; service: string }>(http.get('/health')),

  // ── Warehouses ───────────────────────────────────────────────────────────
  listWarehouses: () => unwrap<Warehouse[]>(http.get('/warehouses')),
  getWarehouse: (id: number) => unwrap<Warehouse>(http.get(`/warehouses/${id}`)),
  getWarehouseSkus: (id: number) => unwrap<Sku[]>(http.get(`/warehouses/${id}/skus`)),
  getWarehouseSlots: (id: number) => unwrap<Slot[]>(http.get(`/warehouses/${id}/slots`)),
  createWarehouse: (payload: WarehouseCreateRequest) =>
    unwrap<Warehouse>(http.post('/warehouses', payload)),

  // ── Upload ───────────────────────────────────────────────────────────────
  uploadLayout: (warehouseId: number, file: File) =>
    unwrap<UploadResult>(http.post(`/upload/layout?warehouseId=${warehouseId}`, uploadForm(file))),
  uploadSkus: (warehouseId: number, file: File) =>
    unwrap<UploadResult>(http.post(`/upload/skus?warehouseId=${warehouseId}`, uploadForm(file))),
  uploadOrders: (warehouseId: number, file: File) =>
    unwrap<UploadResult>(http.post(`/upload/orders?warehouseId=${warehouseId}`, uploadForm(file))),
  uploadMendeley: (strategy: StorageStrategy) =>
    unwrap<MendeleyImportResult>(http.post(`/upload/mendeley?strategy=${strategy}`)),
  listExamples: () => unwrap<DatasetInfo[]>(http.get('/upload/examples')),
  loadExample: (key: string, strategy?: StorageStrategy) =>
    unwrap<MendeleyImportResult>(
      http.post(`/upload/examples/${key}${strategy ? `?strategy=${strategy}` : ''}`),
    ),

  // ── Scoring ──────────────────────────────────────────────────────────────
  runScoring: (req: ScoringRunRequest) =>
    unwrap<ScoringRunResponse>(http.post('/scoring/run', req)),
  getScoringResult: (jobId: string) =>
    unwrap<ScoringRunResponse>(http.get(`/scoring/results/${jobId}`)),
  getCopickMatrix: (warehouseId: number, days = 90) =>
    unwrap<CopickMatrixResponse>(http.get(`/scoring/matrix/${warehouseId}?days=${days}`)),
  getAbcXyz: (warehouseId: number, days = 90) =>
    unwrap<AbcXyzMatrixResponse>(http.get(`/scoring/abcxyz/${warehouseId}?days=${days}`)),
  validateWeights: (weights: ScoringWeights) =>
    unwrap<ScoringWeights>(http.patch('/scoring/weights', weights)),
  simulate: (req: SimulationRequest) =>
    unwrap<SimulationResult>(http.post('/scoring/simulate', req)),
  tune: (req: TuningRequest) => unwrap<TuningResult>(http.post('/scoring/tune', req)),

  // ── Routing ──────────────────────────────────────────────────────────────
  getWarehouseGraph: (warehouseId: number) =>
    unwrap<WarehouseGraphResponse>(http.get(`/routing/graph/${warehouseId}`)),
  optimizeRoute: (payload: { warehouseId: number; skuIds: number[]; cartCapacityKg: number }) =>
    unwrap<Route>(http.post('/routing/optimize', payload)),
  compareRoutes: (payload: {
    warehouseId: number;
    skuIds: number[];
    currentSlots: Record<number, number>;
    proposedSlots: Record<number, number>;
    cartCapacityKg: number;
  }) => unwrap<RouteComparison>(http.post('/routing/compare', payload)),

  // ── Recommendations ──────────────────────────────────────────────────────
  generateRecommendations: (req: ScoringRunRequest) =>
    unwrap<RecommendationResponse[]>(http.post('/recommendations/generate', req)),
  listRecommendations: (
    warehouseId: number,
    params?: { sortBy?: string; limit?: number; status?: string },
  ) => {
    const q = new URLSearchParams();
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    return unwrap<RecommendationResponse[]>(
      http.get(`/recommendations/${warehouseId}?${q.toString()}`),
    );
  },
  getRecommendationDetail: (id: number) =>
    unwrap<RecommendationResponse>(http.get(`/recommendations/detail/${id}`)),
  acceptRecommendation: (id: number) =>
    unwrap<RecommendationResponse>(http.patch(`/recommendations/${id}/accept`)),
  rejectRecommendation: (id: number) =>
    unwrap<RecommendationResponse>(http.patch(`/recommendations/${id}/reject`)),
  acceptAllRecommendations: (warehouseId: number, status = 'PENDING') =>
    unwrap<BulkAcceptResult>(
      http.post(`/recommendations/${warehouseId}/accept-all?status=${status}`),
    ),
};
