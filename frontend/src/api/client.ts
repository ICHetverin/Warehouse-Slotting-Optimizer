import axios from 'axios';
import type { ApiResponse, Warehouse, ScoringRunResponse, ScoringWeights, UploadResult } from '../types';

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
};
