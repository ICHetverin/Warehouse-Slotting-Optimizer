import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Button, Card, Col, Progress, Row, Space, Tag, Tooltip, Typography, } from 'antd';
import { CheckOutlined, CloseOutlined, RiseOutlined, InfoCircleOutlined, NodeIndexOutlined, ThunderboltOutlined, PartitionOutlined, ExperimentOutlined, } from '@ant-design/icons';
const { Text } = Typography;
const REASON_ICON = {
    velocity: _jsx(ThunderboltOutlined, { style: { color: '#1677ff' } }),
    copick: _jsx(PartitionOutlined, { style: { color: '#7C3AED' } }),
    distance: _jsx(NodeIndexOutlined, { style: { color: '#1677ff' } }),
    weight_fit: _jsx(ExperimentOutlined, { style: { color: '#059669' } }),
    general: _jsx(InfoCircleOutlined, { style: { color: '#8c8c8c' } }),
};
const REASON_COLOR = {
    velocity: '#EFF6FF',
    copick: '#F5F3FF',
    distance: '#EFF6FF',
    weight_fit: '#ECFDF5',
    general: '#F9FAFB',
};
function groupReasons(reasons) {
    return [
        {
            key: 'velocity',
            title: 'Оборачиваемость и доступность',
            description: reasons.find(reason => reason.type === 'velocity' || reason.type === 'distance')?.description
                ?? 'SKU получает более удобную и доступную ячейку ближе к контуру отбора.',
            value: reasons.find(reason => reason.type === 'velocity' || reason.type === 'distance')?.value ?? 0,
            color: '#1677ff',
        },
        {
            key: 'copick',
            title: 'Совместный отбор',
            description: reasons.find(reason => reason.type === 'copick')?.description
                ?? 'SKU сближается с позициями, которые чаще берут вместе.',
            value: reasons.find(reason => reason.type === 'copick')?.value ?? 0,
            color: '#7C3AED',
        },
        {
            key: 'weight_fit',
            title: 'Физическая совместимость',
            description: reasons.find(reason => reason.type === 'weight_fit')?.description
                ?? 'Целевой слот лучше подходит по весу и вместимости.',
            value: reasons.find(reason => reason.type === 'weight_fit')?.value ?? 0,
            color: '#059669',
        },
    ];
}
function ReasonRow({ title, description, value, icon, background, color, }) {
    return (_jsxs("div", { style: {
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            background,
            borderRadius: 8,
            marginBottom: 8,
        }, children: [_jsx("span", { style: { marginTop: 1, flexShrink: 0 }, children: icon }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx(Text, { strong: true, style: { display: 'block', fontSize: 12, marginBottom: 4 }, children: title }), _jsx(Text, { style: { fontSize: 13, lineHeight: '1.5' }, children: description }), _jsx("div", { style: { marginTop: 4 }, children: _jsx(Progress, { percent: Math.min(100, Math.round(value * 100)), size: "small", showInfo: false, strokeColor: color, style: { maxWidth: 160 } }) })] }), _jsxs(Tag, { style: { flexShrink: 0, fontSize: 11 }, children: [(value * 100).toFixed(0), "%"] })] }));
}
export function ExplainCard({ rec, onAccept, onReject, accepting, rejecting }) {
    const [expanded, setExpanded] = useState(false);
    const exp = rec.explanation;
    const groupedReasons = exp ? groupReasons(exp.reasons) : [];
    const isPending = rec.status === 'PENDING';
    const isAccepted = rec.status === 'ACCEPTED';
    const isRejected = rec.status === 'REJECTED';
    const statusTag = isAccepted
        ? _jsx(Tag, { color: "success", children: "\u041F\u0440\u0438\u043D\u044F\u0442\u043E" })
        : isRejected
            ? _jsx(Tag, { color: "error", children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E" })
            : _jsx(Tag, { color: "processing", children: "\u041E\u0436\u0438\u0434\u0430\u0435\u0442" });
    const deltaColor = rec.scoreDelta > 0 ? '#16A34A' : rec.scoreDelta < 0 ? '#DC2626' : '#595959';
    return (_jsxs(Card, { size: "small", style: {
            marginBottom: 12,
            borderColor: isAccepted ? '#bbf7d0' : isRejected ? '#fecaca' : '#e5e7eb',
            opacity: isRejected ? 0.65 : 1,
            transition: 'opacity 0.2s',
        }, styles: { body: { padding: '12px 16px' } }, children: [_jsxs(Row, { align: "middle", gutter: 12, wrap: false, children: [_jsxs(Col, { flex: "auto", style: { minWidth: 0 }, children: [_jsxs(Space, { size: 8, wrap: true, children: [_jsx(Text, { strong: true, style: { fontSize: 14 }, children: rec.skuCode }), _jsxs(Text, { style: { fontSize: 12, color: '#8c8c8c' }, children: [rec.fromSlot ?? '—', " ", _jsx("span", { style: { margin: '0 4px' }, children: "\u2192" }), " ", rec.toSlot] }), statusTag] }), exp && (_jsxs("div", { style: { marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }, children: [_jsx(Tooltip, { title: "Score improvement from current to proposed slot", children: _jsxs("span", { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }, children: [_jsx(RiseOutlined, { style: { color: deltaColor } }), _jsxs(Text, { style: { fontSize: 12, color: deltaColor }, children: [rec.scoreDelta > 0 ? '+' : '', rec.scoreDelta.toFixed(3), " score"] })] }) }), exp.impact.avgRouteSavingsM > 0 && (_jsx(Tooltip, { title: "\u041E\u0446\u0435\u043D\u043E\u0447\u043D\u0430\u044F \u044D\u043A\u043E\u043D\u043E\u043C\u0438\u044F \u043F\u0443\u0442\u0438 \u043D\u0430 \u043E\u0434\u0438\u043D \u043E\u0442\u0431\u043E\u0440", children: _jsxs(Text, { style: { fontSize: 12, color: '#595959' }, children: ["~", exp.impact.avgRouteSavingsM.toFixed(1), " \u043C \u043D\u0430 \u043E\u0442\u0431\u043E\u0440"] }) })), exp.impact.dailyPicksAffected > 0 && (_jsxs(Text, { style: { fontSize: 12, color: '#595959' }, children: [exp.impact.dailyPicksAffected, " \u043E\u0442\u0431\u043E\u0440\u043E\u0432 \u0432 \u0434\u0435\u043D\u044C"] })), exp.impact.estimatedDailySavingsMin > 0 && (_jsxs(Text, { style: { fontSize: 12, color: '#16A34A' }, children: ["~", exp.impact.estimatedDailySavingsMin.toFixed(1), " \u043C\u0438\u043D \u0432 \u0434\u0435\u043D\u044C"] }))] }))] }), _jsx(Col, { style: { flexShrink: 0 }, children: _jsxs(Space, { size: 6, children: [exp && exp.reasons.length > 0 && (_jsx(Button, { size: "small", type: "text", style: { fontSize: 12, color: '#1677ff', padding: '0 6px' }, onClick: () => setExpanded(v => !v), children: expanded ? 'Скрыть' : 'Почему переложить?' })), isPending && (_jsxs(_Fragment, { children: [_jsx(Button, { size: "small", type: "primary", icon: _jsx(CheckOutlined, {}), loading: accepting, onClick: () => onAccept(rec.id), style: { background: '#16A34A', borderColor: '#16A34A' }, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C" }), _jsx(Button, { size: "small", danger: true, icon: _jsx(CloseOutlined, {}), loading: rejecting, onClick: () => onReject(rec.id), children: "\u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C" })] }))] }) })] }), expanded && exp && (_jsxs("div", { style: { marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }, children: [_jsx("div", { style: { marginBottom: 10 }, children: _jsxs(Row, { gutter: 16, children: [_jsxs(Col, { span: 12, children: [_jsx("div", { style: { fontSize: 11, color: '#8c8c8c', marginBottom: 2 }, children: "Score \u0434\u043E" }), _jsx(Text, { style: { fontSize: 13 }, children: exp.scoreBefore.toFixed(4) })] }), _jsxs(Col, { span: 12, children: [_jsx("div", { style: { fontSize: 11, color: '#8c8c8c', marginBottom: 2 }, children: "Score \u043F\u043E\u0441\u043B\u0435" }), _jsx(Text, { style: { fontSize: 13, color: '#16A34A' }, children: exp.scoreAfter.toFixed(4) })] })] }) }), groupedReasons.map(reason => (_jsx(ReasonRow, { title: reason.title, description: reason.description, value: reason.value, icon: REASON_ICON[reason.key] ?? REASON_ICON.general, background: REASON_COLOR[reason.key] ?? '#F9FAFB', color: reason.color }, reason.key)))] }))] }));
}
