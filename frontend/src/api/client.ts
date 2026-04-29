import axios from 'axios';
import type {
  ApiResponse,
  Warehouse,
  ScoringRunResponse,
  ScoringWeights,
  UploadResult,
  CopickMatrixResponse,
  WarehouseGraphResponse,
  Route,
  RouteComparison,
  RecommendationResponse,
} from '../types';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000,
});

export const api = {
  // ── Warehouses ─────────────────────────────────────────────────────────────

  listWarehouses(): Promise<ApiResponse<Warehouse[]>> {
    return http.get<ApiResponse<Warehouse[]>>('/warehouses').then(r => r.data);
  },

  createWarehouse(payload: Omit<Warehouse, 'id' | 'createdAt'>): Promise<ApiResponse<Warehouse>> {
    return http.post<ApiResponse<Warehouse>>('/warehouses', payload).then(r => r.data);
  },

  // ── Upload ─────────────────────────────────────────────────────────────────

  uploadLayout(warehouseId: number, file: File): Promise<ApiResponse<UploadResult>> {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<ApiResponse<UploadResult>>(`/upload/layout?warehouseId=${warehouseId}`, form)
      .then(r => r.data);
  },

  uploadSkus(warehouseId: number, file: File): Promise<ApiResponse<UploadResult>> {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<ApiResponse<UploadResult>>(`/upload/skus?warehouseId=${warehouseId}`, form)
      .then(r => r.data);
  },

  uploadOrders(warehouseId: number, file: File): Promise<ApiResponse<UploadResult>> {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<ApiResponse<UploadResult>>(`/upload/orders?warehouseId=${warehouseId}`, form)
      .then(r => r.data);
  },

  // ── Scoring ────────────────────────────────────────────────────────────────

  runScoring(warehouseId: number, weights?: ScoringWeights): Promise<ApiResponse<ScoringRunResponse>> {
    return http
      .post<ApiResponse<ScoringRunResponse>>('/scoring/run', {
        warehouseId,
        weights: weights ?? { w1: 0.5, w2: 0.35, w3: 0.15 },
      })
      .then(r => r.data);
  },

  getCopickMatrix(warehouseId: number, days = 90): Promise<ApiResponse<CopickMatrixResponse>> {
    return http
      .get<ApiResponse<CopickMatrixResponse>>(`/scoring/matrix/${warehouseId}?days=${days}`)
      .then(r => r.data);
  },

  // ── Routing ────────────────────────────────────────────────────────────────

  getWarehouseGraph(warehouseId: number): Promise<ApiResponse<WarehouseGraphResponse>> {
    return http
      .get<ApiResponse<WarehouseGraphResponse>>(`/routing/graph/${warehouseId}`)
      .then(r => r.data);
  },

  optimizeRoute(payload: {
    warehouseId: number;
    skuIds: number[];
    cartCapacityKg: number;
  }): Promise<ApiResponse<Route>> {
    return http.post<ApiResponse<Route>>('/routing/optimize', payload).then(r => r.data);
  },

  compareRoutes(payload: {
    warehouseId: number;
    skuIds: number[];
    currentSlots: Record<number, number>;
    proposedSlots: Record<number, number>;
    cartCapacityKg: number;
  }): Promise<ApiResponse<RouteComparison>> {
    return http.post<ApiResponse<RouteComparison>>('/routing/compare', payload).then(r => r.data);
  },

  // ── Recommendations ────────────────────────────────────────────────────────

  generateRecommendations(
    warehouseId: number,
    weights?: ScoringWeights,
  ): Promise<ApiResponse<RecommendationResponse[]>> {
    return http
      .post<ApiResponse<RecommendationResponse[]>>('/recommendations/generate', {
        warehouseId,
        weights: weights ?? { w1: 0.5, w2: 0.35, w3: 0.15 },
      })
      .then(r => r.data);
  },

  listRecommendations(
    warehouseId: number,
    params?: { sortBy?: string; limit?: number; status?: string },
  ): Promise<ApiResponse<RecommendationResponse[]>> {
    const q = new URLSearchParams();
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.limit)  q.set('limit',  String(params.limit));
    if (params?.status) q.set('status', params.status);
    return http
      .get<ApiResponse<RecommendationResponse[]>>(
        `/recommendations/${warehouseId}?${q.toString()}`,
      )
      .then(r => r.data);
  },

  getRecommendationDetail(id: number): Promise<ApiResponse<RecommendationResponse>> {
    return http
      .get<ApiResponse<RecommendationResponse>>(`/recommendations/detail/${id}`)
      .then(r => r.data);
  },

  acceptRecommendation(id: number): Promise<ApiResponse<RecommendationResponse>> {
    return http
      .patch<ApiResponse<RecommendationResponse>>(`/recommendations/${id}/accept`)
      .then(r => r.data);
  },

  rejectRecommendation(id: number): Promise<ApiResponse<RecommendationResponse>> {
    return http
      .patch<ApiResponse<RecommendationResponse>>(`/recommendations/${id}/reject`)
      .then(r => r.data);
  },
};
