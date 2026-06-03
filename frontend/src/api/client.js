import axios from 'axios';
const http = axios.create({
    baseURL: '/api/v1',
    timeout: 60_000,
});
http.interceptors.response.use(response => response, error => {
    if (axios.isAxiosError(error)) {
        const apiError = error.response?.data?.error;
        const message = apiError?.message ?? apiError?.detail;
        if (message) {
            return Promise.reject(new Error(message));
        }
    }
    return Promise.reject(error);
});
export const DEFAULT_WEIGHTS = {
    w1: 0.5,
    w2: 0.35,
    w3: 0.15,
    decayLambda: 0.03,
    useAbcXyz: true,
};
export const api = {
    listWarehouses() {
        return http.get('/warehouses').then(r => r.data);
    },
    getWarehouse(id) {
        return http.get(`/warehouses/${id}`).then(r => r.data);
    },
    listSkus(warehouseId) {
        return http.get(`/warehouses/${warehouseId}/skus`).then(r => r.data);
    },
    listSlots(warehouseId) {
        return http.get(`/warehouses/${warehouseId}/slots`).then(r => r.data);
    },
    createWarehouse(payload) {
        return http.post('/warehouses', payload).then(r => r.data);
    },
    uploadLayout(warehouseId, file) {
        const form = new FormData();
        form.append('file', file);
        return http.post(`/upload/layout?warehouseId=${warehouseId}`, form).then(r => r.data);
    },
    uploadSkus(warehouseId, file) {
        const form = new FormData();
        form.append('file', file);
        return http.post(`/upload/skus?warehouseId=${warehouseId}`, form).then(r => r.data);
    },
    uploadOrders(warehouseId, file) {
        const form = new FormData();
        form.append('file', file);
        return http.post(`/upload/orders?warehouseId=${warehouseId}`, form).then(r => r.data);
    },
    importMendeley(strategy = 'RANDOM') {
        return http.post(`/upload/mendeley?strategy=${strategy}`).then(r => r.data);
    },
    runScoring(warehouseId, weights, velocityDays = 90) {
        return http.post('/scoring/run', {
            warehouseId,
            velocityDays,
            weights: weights ?? DEFAULT_WEIGHTS,
        }).then(r => r.data);
    },
    getCopickMatrix(warehouseId, days = 90) {
        return http.get(`/scoring/matrix/${warehouseId}?days=${days}`).then(r => r.data);
    },
    getAbcXyzMatrix(warehouseId, days = 90) {
        return http.get(`/scoring/abcxyz/${warehouseId}?days=${days}`).then(r => r.data);
    },
    simulate(payload) {
        return http.post('/scoring/simulate', payload).then(r => r.data);
    },
    tune(payload) {
        return http.post('/scoring/tune', payload).then(r => r.data);
    },
    getWarehouseGraph(warehouseId) {
        return http.get(`/routing/graph/${warehouseId}`).then(r => r.data);
    },
    optimizeRoute(payload) {
        return http.post('/routing/optimize', payload).then(r => r.data);
    },
    compareRoutes(payload) {
        return http.post('/routing/compare', payload).then(r => r.data);
    },
    generateRecommendations(warehouseId, weights) {
        return http.post('/recommendations/generate', {
            warehouseId,
            weights: weights ?? DEFAULT_WEIGHTS,
        }).then(r => r.data);
    },
    listRecommendations(warehouseId, params) {
        const query = new URLSearchParams();
        if (params?.sortBy)
            query.set('sortBy', params.sortBy);
        if (params?.limit)
            query.set('limit', String(params.limit));
        if (params?.status)
            query.set('status', params.status);
        return http.get(`/recommendations/${warehouseId}?${query.toString()}`).then(r => r.data);
    },
    getRecommendationDetail(id) {
        return http.get(`/recommendations/detail/${id}`).then(r => r.data);
    },
    acceptRecommendation(id) {
        return http.patch(`/recommendations/${id}/accept`).then(r => r.data);
    },
    rejectRecommendation(id) {
        return http.patch(`/recommendations/${id}/reject`).then(r => r.data);
    },
    acceptAllRecommendations(warehouseId) {
        return http.post(`/recommendations/accept-all?warehouseId=${warehouseId}`).then(r => r.data);
    },
};
