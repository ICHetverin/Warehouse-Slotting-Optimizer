import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Radio, Row, Space, Spin, Statistic, Typography } from 'antd';
import { api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
const cellColors = {
    empty: '#f5f5f5',
    occupied: '#dbeafe',
    target: '#dcfce7',
    conflict: '#fef3c7',
};
export function WarehouseMapPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [warehouse, setWarehouse] = useState(null);
    const [slots, setSlots] = useState([]);
    const [skus, setSkus] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [mode, setMode] = useState('current');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!warehouseId) {
            setWarehouse(null);
            setSlots([]);
            setSkus([]);
            setRecommendations([]);
            return;
        }
        setLoading(true);
        setError(null);
        void Promise.all([
            api.getWarehouse(warehouseId),
            api.listSlots(warehouseId),
            api.listSkus(warehouseId),
            api.listRecommendations(warehouseId, { status: 'PENDING', sortBy: 'score_delta', limit: 200 }),
        ]).then(([warehouseResponse, slotResponse, skuResponse, recommendationResponse]) => {
            setWarehouse(warehouseResponse.data);
            setSlots(slotResponse.data);
            setSkus(skuResponse.data);
            setRecommendations(recommendationResponse.data);
        }).catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить карту склада');
        }).finally(() => {
            setLoading(false);
        });
    }, [warehouseId]);
    const skuById = useMemo(() => new Map(skus.map(sku => [sku.id, sku])), [skus]);
    const recommendationByTargetLabel = useMemo(() => new Map(recommendations.map(recommendation => [recommendation.toSlot, recommendation])), [recommendations]);
    return (_jsxs("div", { style: { maxWidth: 1320, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "\u041A\u0430\u0440\u0442\u0430 \u0441\u043A\u043B\u0430\u0434\u0430" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u041A\u0430\u0440\u0442\u0430 \u0441\u0434\u0435\u043B\u0430\u043D\u0430 \u0441\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0439: \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u0441\u0435\u0442\u043A\u0430 \u0431\u0435\u0437 \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438 \u0438 \u043F\u0440\u0438\u0431\u043B\u0438\u0436\u0435\u043D\u0438\u044F. \u0412 \u0440\u0435\u0436\u0438\u043C\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u0432\u0438\u0434\u043D\u043E, \u043A\u0430\u043A\u0438\u0435 \u044F\u0447\u0435\u0439\u043A\u0438 \u0446\u0435\u043B\u0435\u0432\u044B\u0435 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u043A\u0438." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsx(Card, { style: { marginBottom: 24 }, children: _jsxs(Row, { gutter: 16, align: "middle", children: [_jsxs(Col, { xs: 24, md: 10, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsxs(Col, { xs: 24, md: 14, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0420\u0435\u0436\u0438\u043C" }), _jsx(Radio.Group, { value: mode, onChange: event => setMode(event.target.value), optionType: "button", buttonStyle: "solid", options: [
                                        { label: 'Текущее размещение', value: 'current' },
                                        { label: 'Цели рекомендаций', value: 'recommended' },
                                    ] })] })] }) }), loading ? (_jsx("div", { style: { textAlign: 'center', padding: 64 }, children: _jsx(Spin, { size: "large" }) })) : !warehouse || slots.length === 0 ? (_jsx(Card, { children: _jsx(Empty, { description: "\u041D\u0435\u0442 \u0441\u0445\u0435\u043C\u044B \u0441\u043A\u043B\u0430\u0434\u0430" }) })) : (_jsxs(_Fragment, { children: [_jsxs(Row, { gutter: 16, style: { marginBottom: 24 }, children: [_jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u042F\u0447\u0435\u0435\u043A", value: slots.length }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "SKU", value: skus.length }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439", value: recommendations.length }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0441\u0435\u0442\u043A\u0438", value: `${warehouse.rows} × ${warehouse.columns}` }) }) })] }), _jsx(Card, { title: "\u0421\u0442\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0441\u0445\u0435\u043C\u0430", extra: (_jsxs(Space, { size: 12, wrap: true, children: [_jsx(Legend, { color: cellColors.empty, label: "\u041F\u0443\u0441\u0442\u0430\u044F" }), _jsx(Legend, { color: cellColors.occupied, label: "\u0417\u0430\u043D\u044F\u0442\u0430" }), _jsx(Legend, { color: cellColors.target, label: "\u0426\u0435\u043B\u044C \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438" }), _jsx(Legend, { color: cellColors.conflict, label: "\u0415\u0441\u0442\u044C \u0442\u0435\u043A\u0443\u0449\u0435\u0435 \u0438 \u0446\u0435\u043B\u0435\u0432\u043E\u0435" })] })), children: _jsx("div", { style: {
                                display: 'grid',
                                gridTemplateColumns: `repeat(${Math.max(warehouse.columns, 1)}, minmax(28px, 1fr))`,
                                gap: 6,
                            }, children: slots
                                .slice()
                                .sort((left, right) => left.row - right.row || left.col - right.col)
                                .map(slot => {
                                const currentSku = slot.currentSkuId ? skuById.get(slot.currentSkuId) : undefined;
                                const targetRecommendation = recommendationByTargetLabel.get(slot.label);
                                const hasCurrent = Boolean(currentSku);
                                const isTarget = Boolean(targetRecommendation);
                                const background = mode === 'recommended'
                                    ? hasCurrent && isTarget ? cellColors.conflict : isTarget ? cellColors.target : hasCurrent ? cellColors.occupied : cellColors.empty
                                    : hasCurrent ? cellColors.occupied : cellColors.empty;
                                return (_jsxs("div", { title: buildSlotTitle(slot, currentSku?.code, targetRecommendation?.skuCode), style: {
                                        minHeight: 58,
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        background,
                                        padding: 6,
                                        fontSize: 11,
                                        overflow: 'hidden',
                                    }, children: [_jsx("div", { style: { fontWeight: 700, marginBottom: 4 }, children: slot.label }), _jsx("div", { style: { color: '#595959' }, children: currentSku?.code ?? 'пусто' }), mode === 'recommended' && targetRecommendation && (_jsxs("div", { style: { marginTop: 4, color: '#166534' }, children: ["\u2192 ", targetRecommendation.skuCode] }))] }, slot.id));
                            }) }) })] }))] }));
}
function Legend({ color, label }) {
    return (_jsxs(Space, { size: 6, children: [_jsx("span", { style: { width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid #d9d9d9', display: 'inline-block' } }), _jsx(Text, { style: { fontSize: 12 }, children: label })] }));
}
function buildSlotTitle(slot, currentSkuCode, targetSkuCode) {
    const lines = [
        `${slot.label} (r${slot.row}, c${slot.col})`,
        `Текущее: ${currentSkuCode ?? 'пусто'}`,
    ];
    if (targetSkuCode) {
        lines.push(`Рекомендуется: ${targetSkuCode}`);
    }
    return lines.join('\n');
}
