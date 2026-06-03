import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Alert, Button, Card, Col, Divider, Row, Slider, Space, Spin, Statistic, Switch, Table, Tag, Typography, } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, PlayCircleOutlined, } from '@ant-design/icons';
import { DEFAULT_WEIGHTS, api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
function WeightControls({ weights, onChange, }) {
    const setWeight = (key, value) => {
        onChange({ ...weights, [key]: value });
    };
    const controls = [
        { key: 'w1', label: 'Оборачиваемость и доступность', color: '#1677ff' },
        { key: 'w2', label: 'Совместный отбор', color: '#7C3AED' },
        { key: 'w3', label: 'Физическая совместимость', color: '#059669' },
    ];
    return (_jsxs(_Fragment, { children: [_jsx(Row, { gutter: 16, children: controls.map(control => (_jsxs(Col, { xs: 24, md: 8, children: [_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx(Text, { style: { fontSize: 12, color: '#595959' }, children: control.label }), _jsx(Text, { strong: true, style: { float: 'right', fontSize: 12 }, children: weights[control.key].toFixed(2) })] }), _jsx(Slider, { min: 0, max: 1, step: 0.05, value: weights[control.key], onChange: value => setWeight(control.key, value), styles: { track: { background: control.color }, handle: { borderColor: control.color } } })] }, control.key))) }), _jsxs(Row, { gutter: 16, style: { marginTop: 8 }, children: [_jsxs(Col, { xs: 24, md: 12, children: [_jsxs("div", { style: { marginBottom: 6 }, children: [_jsx(Text, { style: { fontSize: 12, color: '#595959' }, children: "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u0437\u0430\u0442\u0443\u0445\u0430\u043D\u0438\u044F (\u03BB)" }), _jsx(Text, { strong: true, style: { float: 'right', fontSize: 12 }, children: (weights.decayLambda ?? 0.03).toFixed(3) })] }), _jsx(Slider, { min: 0.001, max: 0.1, step: 0.001, value: weights.decayLambda ?? 0.03, onChange: value => setWeight('decayLambda', value) })] }), _jsx(Col, { xs: 24, md: 12, style: { display: 'flex', alignItems: 'center' }, children: _jsx(Switch, { checked: weights.useAbcXyz ?? true, checkedChildren: "ABC/XYZ: \u0434\u0430", unCheckedChildren: "ABC/XYZ: \u043D\u0435\u0442", onChange: value => setWeight('useAbcXyz', value) }) })] })] }));
}
function ValidationCard({ validation }) {
    if (!validation) {
        return null;
    }
    const items = [
        {
            title: 'Точность прогноза',
            value: validation.forecastMape,
            suffix: '%',
            description: 'MAPE по историческому спросу',
            state: validation.forecastMape < 30 ? 'good' : validation.forecastMape < 50 ? 'warn' : 'bad',
        },
        {
            title: 'Стабильность размещения',
            value: validation.placementStabilityPct,
            suffix: '%',
            description: 'Доля низкорисковых перекладок',
            state: validation.placementStabilityPct >= 80 ? 'good' : validation.placementStabilityPct >= 60 ? 'warn' : 'bad',
        },
        {
            title: 'Выигрыш по маршруту',
            value: validation.routeEfficiencyGainPct,
            suffix: '%',
            description: 'Сокращение дистанции относительно текущего размещения',
            state: validation.routeEfficiencyGainPct > 5 ? 'good' : validation.routeEfficiencyGainPct >= 0 ? 'warn' : 'bad',
        },
    ];
    const iconFor = (state) => {
        if (state === 'good')
            return _jsx(CheckCircleOutlined, { style: { color: '#16A34A' } });
        if (state === 'warn')
            return _jsx(ExclamationCircleOutlined, { style: { color: '#D97706' } });
        return _jsx(CloseCircleOutlined, { style: { color: '#DC2626' } });
    };
    const colorFor = (state) => {
        if (state === 'good')
            return '#16A34A';
        if (state === 'warn')
            return '#D97706';
        return '#DC2626';
    };
    return (_jsxs(Card, { title: "\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F \u043F\u043E 3 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430\u043C", style: { marginBottom: 24 }, children: [_jsx(Row, { gutter: 16, children: items.map(item => (_jsx(Col, { xs: 24, md: 8, children: _jsxs(Card, { size: "small", bordered: false, style: { background: '#fafafa' }, children: [_jsx(Statistic, { title: _jsxs(Space, { size: 6, children: [iconFor(item.state), _jsx(Text, { strong: true, children: item.title })] }), value: item.value, suffix: item.suffix, precision: 1, valueStyle: { fontSize: 28, color: colorFor(item.state) } }), _jsx(Text, { type: "secondary", style: { fontSize: 12 }, children: item.description })] }) }, item.title))) }), _jsx(Divider, { style: { margin: '16px 0' } }), _jsxs(Space, { size: "large", wrap: true, children: [_jsxs(Text, { type: "secondary", style: { fontSize: 12 }, children: ["SKU \u043A\u043B\u0430\u0441\u0441\u0430 A: ", _jsx(Text, { strong: true, children: validation.detail.aClassCount ?? 0 })] }), _jsxs(Text, { type: "secondary", style: { fontSize: 12 }, children: ["SKU \u043A\u043B\u0430\u0441\u0441\u0430 X: ", _jsx(Text, { strong: true, children: validation.detail.xClassCount ?? 0 })] }), _jsxs(Text, { type: "secondary", style: { fontSize: 12 }, children: ["\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u043F\u0440\u0438\u0440\u043E\u0441\u0442 score: ", _jsx(Text, { strong: true, children: (validation.detail.avgScoreDelta ?? 0).toFixed(3) })] })] })] }));
}
const columns = [
    {
        title: 'SKU',
        dataIndex: 'skuCode',
        width: 140,
    },
    {
        title: 'Из',
        dataIndex: 'fromLabel',
        width: 110,
        render: (value) => value ?? _jsx(Text, { type: "secondary", children: "\u2014" }),
    },
    {
        title: 'В',
        dataIndex: 'toLabel',
        width: 110,
    },
    {
        title: 'Score',
        dataIndex: 'score',
        width: 110,
        align: 'right',
        render: (value) => value.toFixed(3),
    },
    {
        title: 'Прирост',
        dataIndex: 'scoreDelta',
        width: 120,
        align: 'right',
        render: (value) => (_jsxs(Tag, { color: value > 0 ? 'success' : value < 0 ? 'error' : 'default', children: [value > 0 ? '+' : '', value.toFixed(3)] })),
    },
];
export function ScoringPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const run = async () => {
        if (!warehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.runScoring(warehouseId, weights);
            setResult(response.data);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось выполнить скоринг');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 1180, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "\u0421\u043A\u043E\u0440\u0438\u043D\u0433 \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432\u0430\u043B\u0438\u0434\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u043E \u0442\u0440\u0451\u043C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430\u043C: \u0442\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0430, \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u043A\u0438 \u0438 \u0432\u044B\u0438\u0433\u0440\u044B\u0448 \u043F\u043E \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0443. \u042D\u0442\u043E \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u044D\u043A\u0440\u0430\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0438." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsxs(Card, { style: { marginBottom: 24 }, children: [_jsxs(Row, { gutter: 16, align: "middle", children: [_jsxs(Col, { xs: 24, md: 8, children: [_jsx("div", { style: { marginBottom: 8 }, children: _jsx(Text, { style: { fontSize: 12, color: '#595959' }, children: "\u0421\u043A\u043B\u0430\u0434" }) }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsx(Col, { xs: 24, md: 16, children: _jsx(WeightControls, { weights: weights, onChange: setWeights }) })] }), _jsx(Divider, {}), _jsx(Button, { type: "primary", icon: _jsx(PlayCircleOutlined, {}), loading: loading, onClick: () => void run(), children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u043A\u043E\u0440\u0438\u043D\u0433" })] }), loading && (_jsx("div", { style: { textAlign: 'center', padding: 48 }, children: _jsx(Spin, { size: "large" }) })), result && !loading && (_jsxs(_Fragment, { children: [_jsx(ValidationCard, { validation: result.validation }), _jsxs(Row, { gutter: 16, style: { marginBottom: 24 }, children: [_jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439", value: result.totalAssignments }) }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0423\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0439", value: result.improved }) }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041E\u043A\u043D\u043E \u043E\u0431\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u043E\u0441\u0442\u0438", value: result.velocityDays, suffix: "\u0434\u043D" }) }) })] }), _jsx(Card, { title: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F SKU -> \u0441\u043B\u043E\u0442", children: _jsx(Table, { rowKey: record => `${record.skuId}-${record.toSlotId}`, dataSource: result.assignments, columns: columns, size: "small", pagination: { pageSize: 12, showSizeChanger: false }, scroll: { x: 640 } }) })] }))] }));
}
