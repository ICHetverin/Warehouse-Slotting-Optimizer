import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Alert, Button, Card, Col, Empty, InputNumber, Row, Select, Statistic, Table, Typography } from 'antd';
import { PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
export function TuningPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [gridStep, setGridStep] = useState(0.1);
    const [metricToOpt, setMetricToOpt] = useState('routeEfficiency');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const run = async () => {
        if (!warehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.tune({ warehouseId, gridStep, metricToOpt });
            setResult(response.data);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось подобрать веса');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsxs(Title, { level: 3, children: [_jsx(ThunderboltOutlined, { style: { marginRight: 8 } }), "\u0410\u0432\u0442\u043E\u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430"] }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "Grid-search \u043F\u043E \u0432\u0435\u0441\u0430\u043C \u0442\u0440\u0451\u0445 \u043A\u043E\u043C\u043F\u043E\u043D\u0435\u043D\u0442\u043E\u0432 \u0441\u043A\u043E\u0440\u0438\u043D\u0433\u0430." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsx(Card, { style: { marginBottom: 24 }, children: _jsxs(Row, { gutter: 16, align: "bottom", children: [_jsxs(Col, { xs: 24, md: 8, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsxs(Col, { xs: 24, md: 6, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0428\u0430\u0433 \u0441\u0435\u0442\u043A\u0438" }), _jsx(InputNumber, { min: 0.05, max: 0.5, step: 0.05, value: gridStep, onChange: value => setGridStep(value ?? 0.1), style: { width: '100%' } })] }), _jsxs(Col, { xs: 24, md: 6, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u043C\u0435\u0442\u0440\u0438\u043A\u0430" }), _jsx(Select, { value: metricToOpt, style: { width: '100%' }, onChange: value => setMetricToOpt(value), options: [
                                        { value: 'routeEfficiency', label: 'Маршрут' },
                                        { value: 'stability', label: 'Стабильность' },
                                        { value: 'composite', label: 'Сводная' },
                                    ] })] }), _jsx(Col, { xs: 24, md: 4, children: _jsx(Button, { type: "primary", icon: _jsx(PlayCircleOutlined, {}), loading: loading, onClick: () => void run(), children: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C" }) })] }) }), result ? (_jsxs(_Fragment, { children: [_jsxs(Row, { gutter: 16, style: { marginBottom: 24 }, children: [_jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041B\u0443\u0447\u0448\u0430\u044F \u043C\u0435\u0442\u0440\u0438\u043A\u0430", value: result.bestMetricValue, precision: 2 }) }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041F\u0440\u0438\u0440\u043E\u0441\u0442", value: result.improvementPct, suffix: "%", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E \u043A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u0439", value: result.evaluations }) }) })] }), _jsx(Card, { title: "\u0421\u0435\u0442\u043A\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432", children: _jsx(Table, { rowKey: (row) => `${row.w1}-${row.w2}-${row.w3}`, size: "small", dataSource: result.scoreGrid, pagination: { pageSize: 12, showSizeChanger: false }, columns: [
                                { title: 'w1', dataIndex: 'w1', render: (value) => value.toFixed(2) },
                                { title: 'w2', dataIndex: 'w2', render: (value) => value.toFixed(2) },
                                { title: 'w3', dataIndex: 'w3', render: (value) => value.toFixed(2) },
                                { title: 'Метрика', dataIndex: 'metric', render: (value) => value.toFixed(2) },
                            ] }) })] })) : (!loading && _jsx(Card, { children: _jsx(Empty, { description: "\u0410\u0432\u0442\u043E\u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430\u0441\u044C" }) }))] }));
}
