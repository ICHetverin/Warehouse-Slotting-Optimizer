import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Select, Space, Spin, Typography } from 'antd';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { DEFAULT_WEIGHTS, api } from '../api/client';
import { ExplainCard } from '../components/ExplainCard';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
export function RecommendationsPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [recommendations, setRecommendations] = useState([]);
    const [statusFilter, setStatusFilter] = useState('PENDING');
    const [loading, setLoading] = useState(false);
    const [generateLoading, setGenerateLoading] = useState(false);
    const [acceptAllLoading, setAcceptAllLoading] = useState(false);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const load = async () => {
        if (!warehouseId) {
            setRecommendations([]);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.listRecommendations(warehouseId, {
                status: statusFilter,
                sortBy: 'score_delta',
                limit: 50,
            });
            setRecommendations(response.data);
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить рекомендации');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void load();
    }, [warehouseId, statusFilter]);
    const generate = async () => {
        if (!warehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setGenerateLoading(true);
        setError(null);
        try {
            await api.generateRecommendations(warehouseId, DEFAULT_WEIGHTS);
            await load();
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось построить рекомендации');
        }
        finally {
            setGenerateLoading(false);
        }
    };
    const handleAccept = async (id) => {
        setBusyId(id);
        try {
            await api.acceptRecommendation(id);
            await load();
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось принять рекомендацию');
        }
        finally {
            setBusyId(null);
        }
    };
    const handleReject = async (id) => {
        setBusyId(id);
        try {
            await api.rejectRecommendation(id);
            await load();
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось отклонить рекомендацию');
        }
        finally {
            setBusyId(null);
        }
    };
    const handleAcceptAll = async () => {
        if (!warehouseId) {
            return;
        }
        setAcceptAllLoading(true);
        try {
            await api.acceptAllRecommendations(warehouseId);
            await load();
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось применить все рекомендации');
        }
        finally {
            setAcceptAllLoading(false);
        }
    };
    return (_jsxs("div", { style: { maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438 \u043F\u043E \u043F\u0435\u0440\u0435\u043A\u043B\u0430\u0434\u043A\u0435" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E SKU \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u043F\u043E \u0442\u0440\u0451\u043C \u0444\u0430\u043A\u0442\u043E\u0440\u0430\u043C: \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u044C, \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u044B\u0439 \u043E\u0442\u0431\u043E\u0440 \u0438 \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C \u0441\u043B\u043E\u0442\u0430." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsx(Card, { style: { marginBottom: 24 }, children: _jsxs(Space, { size: 12, wrap: true, style: { width: '100%', justifyContent: 'space-between' }, children: [_jsxs("div", { style: { minWidth: 280, flex: 1 }, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), _jsxs("div", { style: { minWidth: 220 }, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx(Select, { style: { width: '100%' }, value: statusFilter, options: [
                                        { value: 'PENDING', label: 'Ожидают' },
                                        { value: 'ACCEPTED', label: 'Принятые' },
                                        { value: 'REJECTED', label: 'Отклонённые' },
                                    ], onChange: value => setStatusFilter(value) })] }), _jsxs(Space, { align: "end", wrap: true, children: [_jsx(Button, { icon: _jsx(ReloadOutlined, {}), loading: generateLoading, onClick: () => void generate(), children: "\u041F\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044C" }), _jsx(Button, { type: "primary", icon: _jsx(CheckCircleOutlined, {}), loading: acceptAllLoading, disabled: !warehouseId || statusFilter !== 'PENDING', onClick: () => void handleAcceptAll(), children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0432\u0441\u0435" })] })] }) }), loading ? (_jsx("div", { style: { textAlign: 'center', padding: 48 }, children: _jsx(Spin, { size: "large" }) })) : recommendations.length === 0 ? (_jsx(Card, { children: _jsx(Empty, { description: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442" }) })) : (recommendations.map(recommendation => (_jsx(ExplainCard, { rec: recommendation, onAccept: id => void handleAccept(id), onReject: id => void handleReject(id), accepting: busyId === recommendation.id, rejecting: busyId === recommendation.id }, recommendation.id))))] }));
}
