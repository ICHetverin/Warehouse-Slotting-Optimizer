import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Divider, Form, Input, Select, Space, Steps, Typography, } from 'antd';
import { CheckCircleFilled, DatabaseOutlined } from '@ant-design/icons';
import { DropZone } from '../components/Upload/DropZone';
import { api } from '../api/client';
import { persistWarehouseId } from '../utils/warehouse';
const { Title, Text, Paragraph } = Typography;
const stepKeys = ['warehouse', 'layout', 'skus', 'orders', 'done'];
const stepTitles = ['Склад', 'Схема', 'SKU', 'Заказы', 'Готово'];
export function UploadPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState('warehouse');
    const [warehouses, setWarehouses] = useState([]);
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
    const [newWarehouseName, setNewWarehouseName] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [demoLoading, setDemoLoading] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        void api.listWarehouses()
            .then(response => setWarehouses(response.data))
            .catch(() => undefined);
    }, []);
    const currentIndex = stepKeys.indexOf(step);
    const rememberWarehouse = (warehouseId) => {
        setSelectedWarehouseId(warehouseId);
        persistWarehouseId(warehouseId);
    };
    const handleSuccess = (label, count, nextStep) => {
        setResults(prev => [...prev, { label, count }]);
        setLoading(false);
        setError(null);
        setStep(nextStep);
    };
    const handleWarehouseStep = async () => {
        if (selectedWarehouseId) {
            setStep('layout');
            return;
        }
        if (!newWarehouseName.trim()) {
            setError('Введите название склада');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.createWarehouse({
                name: newWarehouseName.trim(),
                rows: 25,
                columns: 20,
                dockX: 0,
                dockY: 0,
                aisleWidthM: 1.5,
            });
            rememberWarehouse(response.data.id);
            setWarehouses(prev => [...prev, response.data]);
            setStep('layout');
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось создать склад');
        }
        finally {
            setLoading(false);
        }
    };
    const handleDemoImport = async () => {
        setDemoLoading(true);
        setError(null);
        try {
            const response = await api.importMendeley('RANDOM');
            const data = response.data;
            const warehouseId = Number(data.warehouseId);
            rememberWarehouse(warehouseId);
            setResults([
                { label: 'Склад', count: warehouseId },
                { label: 'SKU', count: Number(data.skuCount ?? 0) },
                { label: 'Ячейки', count: Number(data.slotCount ?? 0) },
                { label: 'Заказы', count: Number(data.orderCount ?? 0) },
            ]);
            setStep('done');
        }
        catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Не удалось импортировать демо-набор');
        }
        finally {
            setDemoLoading(false);
        }
    };
    const upload = async (file, action, label, nextStep) => {
        if (!selectedWarehouseId) {
            setError('Сначала выберите склад');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await action(selectedWarehouseId, file);
            handleSuccess(label, response.data.imported, nextStep);
        }
        catch (nextError) {
            setLoading(false);
            setError(nextError instanceof Error ? nextError.message : 'Не удалось загрузить файл');
        }
    };
    return (_jsxs("div", { style: { maxWidth: 760, margin: '0 auto', padding: '40px 24px 64px' }, children: [_jsx(Title, { level: 3, style: { marginBottom: 4 }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445" }), _jsx(Paragraph, { type: "secondary", style: { marginBottom: 28 }, children: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u044C\u0442\u0435 \u0441\u043A\u043B\u0430\u0434, \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u0445\u0435\u043C\u0443, \u043A\u0430\u0442\u0430\u043B\u043E\u0433 SKU \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0437\u0430\u043A\u0430\u0437\u043E\u0432. \u041F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0433\u043E \u043C\u043E\u0436\u043D\u043E \u0441\u0440\u0430\u0437\u0443 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u0441\u043A\u043E\u0440\u0438\u043D\u0433 \u0438 \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u043E\u0431\u044A\u044F\u0441\u043D\u0438\u043C\u044B\u0435 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0438." }), _jsx(Steps, { current: currentIndex, size: "small", items: stepTitles.map((title, index) => ({
                    title,
                    status: index < currentIndex ? 'finish' : index === currentIndex ? 'process' : 'wait',
                })), style: { marginBottom: 24 } }), results.length > 0 && (_jsx(Space, { direction: "vertical", size: 4, style: { width: '100%', marginBottom: 20 }, children: results.map(item => (_jsxs(Space, { size: 8, children: [_jsx(CheckCircleFilled, { style: { color: '#16A34A' } }), _jsxs(Text, { style: { fontSize: 13 }, children: [item.label, ": ", _jsx(Text, { strong: true, children: item.count.toLocaleString() })] })] }, item.label))) })), error && (_jsx(Alert, { type: "error", showIcon: true, closable: true, message: error, style: { marginBottom: 16 }, onClose: () => setError(null) })), step === 'warehouse' && (_jsxs(_Fragment, { children: [_jsx(Card, { title: "1. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u0441\u043A\u043B\u0430\u0434", style: { marginBottom: 16 }, children: _jsxs(Form, { layout: "vertical", children: [warehouses.length > 0 && (_jsx(Form.Item, { label: "\u0421\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0441\u043A\u043B\u0430\u0434\u044B", children: _jsx(Select, { placeholder: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0441\u043A\u043B\u0430\u0434", value: selectedWarehouseId ?? undefined, allowClear: true, options: warehouses.map(warehouse => ({
                                            label: warehouse.name,
                                            value: warehouse.id,
                                        })), onChange: (value) => rememberWarehouse(value ?? null) }) })), !selectedWarehouseId && (_jsx(Form.Item, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E \u0441\u043A\u043B\u0430\u0434\u0430", children: _jsx(Input, { placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u043A\u043B\u0430\u0434", value: newWarehouseName, onChange: event => setNewWarehouseName(event.target.value), onPressEnter: () => void handleWarehouseStep() }) })), _jsx(Button, { type: "primary", block: true, loading: loading, onClick: () => void handleWarehouseStep(), children: selectedWarehouseId ? 'Продолжить' : 'Создать и продолжить' })] }) }), _jsx(Divider, { children: "\u0438\u043B\u0438" }), _jsxs(Card, { title: _jsxs(_Fragment, { children: [_jsx(DatabaseOutlined, {}), " \u0414\u0435\u043C\u043E-\u043D\u0430\u0431\u043E\u0440"] }), children: [_jsx(Paragraph, { type: "secondary", style: { marginBottom: 16 }, children: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0435\u0442 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F \u0431\u044B\u0441\u0442\u0440\u043E\u0433\u043E \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0432\u0441\u0435\u0433\u043E \u043A\u043E\u043D\u0442\u0443\u0440\u0430: \u0441\u043A\u043B\u0430\u0434, SKU, \u044F\u0447\u0435\u0439\u043A\u0438 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u043E\u0432." }), _jsx(Button, { type: "primary", block: true, loading: demoLoading, onClick: () => void handleDemoImport(), children: "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0434\u0435\u043C\u043E-\u043D\u0430\u0431\u043E\u0440" })] })] })), step === 'layout' && (_jsxs(Card, { title: "2. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u0445\u0435\u043C\u0443 \u0441\u043A\u043B\u0430\u0434\u0430", children: [_jsxs(Paragraph, { type: "secondary", children: ["CSV: ", _jsx(Text, { code: true, children: "slot_label,row,col,level,zone,capacity_kg" })] }), _jsx(DropZone, { label: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 layout.csv \u0441\u044E\u0434\u0430", hint: "slot_label,row,col,level,zone,capacity_kg", disabled: loading, onFile: file => void upload(file, api.uploadLayout, 'Схема', 'skus') })] })), step === 'skus' && (_jsxs(Card, { title: "3. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u043A\u0430\u0442\u0430\u043B\u043E\u0433 SKU", children: [_jsxs(Paragraph, { type: "secondary", children: ["CSV: ", _jsx(Text, { code: true, children: "code,name,weight_kg,volume_m3,category" })] }), _jsx(DropZone, { label: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 skus.csv \u0441\u044E\u0434\u0430", hint: "code,name,weight_kg,volume_m3,category", disabled: loading, onFile: file => void upload(file, api.uploadSkus, 'SKU', 'orders') })] })), step === 'orders' && (_jsxs(Card, { title: "4. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0437\u0430\u043A\u0430\u0437\u043E\u0432", children: [_jsxs(Paragraph, { type: "secondary", children: ["CSV: ", _jsx(Text, { code: true, children: "order_id,sku_code,quantity,timestamp" })] }), _jsx(DropZone, { label: "\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 orders.csv \u0441\u044E\u0434\u0430", hint: "order_id,sku_code,quantity,timestamp", disabled: loading, onFile: file => void upload(file, api.uploadOrders, 'Заказы', 'done') })] })), step === 'done' && (_jsxs(Card, { title: "\u0414\u0430\u043D\u043D\u044B\u0435 \u0433\u043E\u0442\u043E\u0432\u044B", children: [_jsx(Paragraph, { style: { marginBottom: 16 }, children: "\u0418\u043C\u043F\u043E\u0440\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D. \u0422\u0435\u043F\u0435\u0440\u044C \u043C\u043E\u0436\u043D\u043E \u043F\u0435\u0440\u0435\u0439\u0442\u0438 \u0432 \u0441\u043A\u043E\u0440\u0438\u043D\u0433 \u0438 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0440\u0430\u0437\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u0441 \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0435\u0439 \u043F\u043E \u0442\u0440\u0451\u043C \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u0430\u043C." }), _jsx(Button, { type: "primary", block: true, disabled: !selectedWarehouseId, onClick: () => selectedWarehouseId && navigate(`/scoring?warehouseId=${selectedWarehouseId}`), children: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u0441\u043A\u043E\u0440\u0438\u043D\u0433\u0443" })] }))] }));
}
