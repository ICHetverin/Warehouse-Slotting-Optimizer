import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Row, Spin, Table, Tag, Typography } from 'antd';
import { api } from '../api/client';
import { WarehouseSelect } from '../components/WarehouseSelect';
import { useWarehouseSelection } from '../hooks/useWarehouseSelection';
const { Title, Paragraph, Text } = Typography;
const abcColors = { A: 'red', B: 'gold', C: 'green' };
const xyzColors = { X: 'blue', Y: 'purple', Z: 'default' };
export function AnalyticsPage() {
    const { warehouseId, setWarehouseId, warehouses, warehousesLoading, warehousesError } = useWarehouseSelection();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!warehouseId) {
            setProfiles([]);
            return;
        }
        setLoading(true);
        setError(null);
        void api.getAbcXyzMatrix(warehouseId)
            .then(response => setProfiles(response.data.profiles))
            .catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить ABC/XYZ аналитику');
        })
            .finally(() => setLoading(false));
    }, [warehouseId]);
    const totals = useMemo(() => ({
        total: profiles.length,
        aClass: profiles.filter(profile => profile.abcClass === 'A').length,
        zClass: profiles.filter(profile => profile.xyzClass === 'Z').length,
    }), [profiles]);
    return (_jsxs("div", { style: { maxWidth: 1120, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "ABC / XYZ \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 24 }, children: "\u0421\u0440\u0435\u0437 \u043F\u043E \u043E\u0431\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u043E\u0441\u0442\u0438 \u0438 \u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0441\u043F\u0440\u043E\u0441\u0430 \u0434\u043B\u044F \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044F \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0430\u0441\u0441\u043E\u0440\u0442\u0438\u043C\u0435\u043D\u0442\u0430 \u0438 \u0432\u0435\u0441\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0445 \u0440\u0435\u0448\u0435\u043D\u0438\u0439 \u0432 \u0441\u043A\u043E\u0440\u0438\u043D\u0433\u0435." }), warehousesError && _jsx(Alert, { type: "warning", showIcon: true, message: warehousesError, style: { marginBottom: 16 } }), error && _jsx(Alert, { type: "error", showIcon: true, message: error, style: { marginBottom: 16 } }), _jsxs(Card, { style: { marginBottom: 24 }, children: [_jsx(Text, { style: { display: 'block', fontSize: 12, color: '#595959', marginBottom: 8 }, children: "\u0421\u043A\u043B\u0430\u0434" }), _jsx(WarehouseSelect, { warehouses: warehouses, value: warehouseId, loading: warehousesLoading, onChange: setWarehouseId })] }), loading ? (_jsx("div", { style: { textAlign: 'center', padding: 48 }, children: _jsx(Spin, { size: "large" }) })) : profiles.length === 0 ? (_jsx(Card, { children: _jsx(Empty, { description: "\u0414\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0438 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442" }) })) : (_jsxs(_Fragment, { children: [_jsxs(Row, { gutter: 16, style: { marginBottom: 24 }, children: [_jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { title: "\u0412\u0441\u0435\u0433\u043E SKU", children: totals.total }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { title: "SKU \u043A\u043B\u0430\u0441\u0441\u0430 A", children: totals.aClass }) }), _jsx(Col, { xs: 24, md: 8, children: _jsx(Card, { title: "\u041D\u0435\u0441\u0442\u0430\u0431\u0438\u043B\u044C\u043D\u044B\u0435 SKU (Z)", children: totals.zClass }) })] }), _jsx(Card, { title: "\u041F\u0440\u043E\u0444\u0438\u043B\u0438 SKU", children: _jsx(Table, { rowKey: "skuId", dataSource: profiles, size: "small", pagination: { pageSize: 12, showSizeChanger: false }, scroll: { x: 640 }, columns: [
                                { title: 'SKU', dataIndex: 'skuCode' },
                                { title: 'ABC', dataIndex: 'abcClass', render: (value) => _jsx(Tag, { color: abcColors[value], children: value }) },
                                { title: 'XYZ', dataIndex: 'xyzClass', render: (value) => _jsx(Tag, { color: xyzColors[value], children: value }) },
                                { title: 'Оборачиваемость', dataIndex: 'velocityScore', render: (value) => value.toFixed(3) },
                                { title: 'CV', dataIndex: 'stabilityCv', render: (value) => value.toFixed(2) },
                                { title: 'Отборы', dataIndex: 'pickCount' },
                            ] }) })] }))] }));
}
