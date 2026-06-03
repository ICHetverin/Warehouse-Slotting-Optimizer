import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Empty, InputNumber, Row, Space, Spin, Statistic, Table, Typography } from 'antd';
import { EnvironmentOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
export function RoutesPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [skus, setSkus] = useState([]);
    const [slots, setSlots] = useState([]);
    const [comparison, setComparison] = useState(null);
    const [rows, setRows] = useState([]);
    const [cartCapacityKg, setCartCapacityKg] = useState(80);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!warehouseId) {
            setSkus([]);
            setSlots([]);
            return;
        }
        void Promise.all([
            api.listSkus(warehouseId),
            api.listSlots(warehouseId),
        ]).then(([skuResponse, slotResponse]) => {
            setSkus(skuResponse.data);
            setSlots(slotResponse.data);
        }).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить данные склада');
        });
    }, [warehouseId]);
    const slotById = useMemo(() => new Map(slots.map(slot => [slot.id, slot])), [slots]);
    const runCompare = async () => {
        if (!warehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            let recommendations = (await api.listRecommendations(warehouseId, {
                status: 'PENDING',
                sortBy: 'score_delta',
                limit: 20,
            })).data;
            if (recommendations.length === 0) {
                recommendations = (await api.generateRecommendations(warehouseId)).data;
            }
            const currentSlots = {};
            const proposedSlots = {};
            recommendations.forEach(recommendation => {
                const sku = skus.find(item => item.id === recommendation.skuId);
                const currentSlot = slots.find(slot => slot.currentSkuId === recommendation.skuId);
                const proposedSlot = slots.find(slot => slot.label === recommendation.toSlot);
                if (sku && currentSlot && proposedSlot) {
                    currentSlots[sku.id] = currentSlot.id;
                    proposedSlots[sku.id] = proposedSlot.id;
                }
            });
            const comparisonResponse = await api.compareRoutes({
                warehouseId,
                skuIds: Object.keys(currentSlots).map(Number),
                cartCapacityKg,
                currentSlots,
                proposedSlots,
            });
            setComparison(comparisonResponse.data);
            setRows(buildRows(recommendations, slotById));
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось сравнить маршруты');
        }
        finally {
            setLoading(false);
        }
    };
    const runOptimize = async () => {
        if (!warehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const topSkuIds = skus.slice(0, 12).map(sku => sku.id);
            const route = await api.optimizeRoute({
                warehouseId,
                skuIds: topSkuIds,
                cartCapacityKg,
            });
            setComparison({
                currentDistanceM: route.data.totalDistanceM,
                proposedDistanceM: route.data.totalDistanceM,
                savingsM: 0,
                savingsPct: 0,
                currentRoute: route.data,
                proposedRoute: route.data,
            });
            setRows([]);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось построить маршрут');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "\u041C\u0430\u0440\u0448\u0440\u0443\u0442\u044B \u043E\u0442\u0431\u043E\u0440\u0430" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0441\u0442\u0440\u043E\u0438\u0442\u0441\u044F \u043C\u0435\u0436\u0434\u0443 \u0442\u0435\u043A\u0443\u0449\u0438\u043C\u0438 \u0441\u043B\u043E\u0442\u0430\u043C\u0438 \u0438 \u0441\u043B\u043E\u0442\u0430\u043C\u0438 \u0438\u0437 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439. \u042D\u0442\u043E \u0434\u0430\u0451\u0442 \u043F\u043E\u043D\u044F\u0442\u043D\u044B\u0439 \u044D\u0444\u0444\u0435\u043A\u0442 \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u043A\u0438 \u0432 \u043C\u0435\u0442\u0440\u0430\u0445 \u0438 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u0430\u0445." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsx(Card, { style: { marginBottom: 24 }, children: _jsxs(Row, { gutter: 16, align: "bottom", children: [_jsxs(Col, { xs: 24, md: 10, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsxs(Col, { xs: 24, md: 6, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0401\u043C\u043A\u043E\u0441\u0442\u044C \u0442\u0435\u043B\u0435\u0436\u043A\u0438, \u043A\u0433" }), _jsx(InputNumber, { min: 1, style: { width: '100%' }, value: cartCapacityKg, onChange: value => setCartCapacityKg(value ?? 80) })] }), _jsx(Col, { xs: 24, md: 8, children: _jsxs(Space, { wrap: true, children: [_jsx(Button, { type: "primary", icon: _jsx(EnvironmentOutlined, {}), loading: loading, onClick: () => void runCompare(), children: "\u0421\u0440\u0430\u0432\u043D\u0438\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u0438 \u043D\u043E\u0432\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442" }), _jsx(Button, { icon: _jsx(PlayCircleOutlined, {}), loading: loading, onClick: () => void runOptimize(), children: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442" })] }) })] }) }), loading ? (_jsx("div", { style: { textAlign: 'center', padding: 48 }, children: _jsx(Spin, { size: "large" }) })) : comparison ? (_jsxs(_Fragment, { children: [_jsxs(Row, { gutter: 16, style: { marginBottom: 24 }, children: [_jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", value: comparison.currentDistanceM, suffix: "\u043C", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u043C\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", value: comparison.proposedDistanceM, suffix: "\u043C", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F", value: comparison.savingsM, suffix: "\u043C", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F", value: comparison.savingsPct, suffix: "%", precision: 1 }) }) })] }), _jsx(Card, { title: "SKU \u0432 \u0441\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0438 \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0430", style: { marginBottom: 24 }, children: rows.length === 0 ? (_jsx(Empty, { description: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442 \u0431\u0435\u0437 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u043A\u0438" })) : (_jsx(Table, { rowKey: row => row.skuId, dataSource: rows, size: "small", pagination: false, columns: [
                                { title: 'SKU', dataIndex: 'skuCode' },
                                { title: 'Текущий слот', dataIndex: 'currentSlot' },
                                { title: 'Предлагаемый слот', dataIndex: 'proposedSlot' },
                            ] })) })] })) : (_jsx(Card, { children: _jsx(Empty, { description: "\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u0435\u0449\u0451 \u043D\u0435 \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D" }) }))] }));
}
function buildRows(recommendations, slotById) {
    return recommendations.map(recommendation => ({
        skuId: recommendation.skuId,
        skuCode: recommendation.skuCode,
        currentSlot: recommendation.fromSlot ?? '—',
        proposedSlot: recommendation.toSlot || slotById.get(recommendation.skuId)?.label || '—',
    }));
}
