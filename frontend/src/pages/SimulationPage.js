import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Alert, Button, Card, Col, Empty, InputNumber, Row, Statistic, Typography } from 'antd';
import { ExperimentOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
export function SimulationPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [sampleSize, setSampleSize] = useState(100);
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
            const response = await api.simulate({ warehouseId, sampleSize });
            setResult(response.data);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось выполнить симуляцию');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsxs(Title, { level: 3, children: [_jsx(ExperimentOutlined, { style: { marginRight: 8 } }), "\u0421\u0438\u043C\u0443\u043B\u044F\u0446\u0438\u044F"] }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u041F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u043F\u0440\u043E\u0433\u043E\u043D \u0438\u0441\u0442\u043E\u0440\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u044D\u0444\u0444\u0435\u043A\u0442\u0430 \u043E\u0442 \u043D\u043E\u0432\u043E\u0433\u043E \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsx(Card, { style: { marginBottom: 24 }, children: _jsxs(Row, { gutter: 16, align: "bottom", children: [_jsxs(Col, { xs: 24, md: 12, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsxs(Col, { xs: 24, md: 6, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0420\u0430\u0437\u043C\u0435\u0440 \u0432\u044B\u0431\u043E\u0440\u043A\u0438" }), _jsx(InputNumber, { min: 10, max: 1000, value: sampleSize, onChange: value => setSampleSize(value ?? 100), style: { width: '100%' } })] }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Button, { type: "primary", icon: _jsx(PlayCircleOutlined, {}), loading: loading, onClick: () => void run(), children: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C" }) })] }) }), result ? (_jsxs(Row, { gutter: 16, children: [_jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0417\u0430\u043A\u0430\u0437\u043E\u0432", value: result.ordersSampled }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u042D\u043A\u043E\u043D\u043E\u043C\u0438\u044F", value: result.savingsPct, suffix: "%", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u0414\u043E", value: result.totalBeforeDistanceM, suffix: "\u043C", precision: 1 }) }) }), _jsx(Col, { xs: 24, md: 6, children: _jsx(Card, { children: _jsx(Statistic, { title: "\u041F\u043E\u0441\u043B\u0435", value: result.totalAfterDistanceM, suffix: "\u043C", precision: 1 }) }) })] })) : (!loading && _jsx(Card, { children: _jsx(Empty, { description: "\u0421\u0438\u043C\u0443\u043B\u044F\u0446\u0438\u044F \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u043B\u0430\u0441\u044C" }) }))] }));
}
