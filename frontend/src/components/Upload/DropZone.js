import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Upload, Typography } from 'antd';
import { CheckCircleFilled, InboxOutlined } from '@ant-design/icons';
const { Text } = Typography;
export function DropZone({ label, accept = '.csv', hint, onFile, disabled }) {
    const [fileName, setFileName] = useState(null);
    return (_jsxs(Upload.Dragger, { accept: accept, disabled: disabled, showUploadList: false, beforeUpload: file => {
            setFileName(file.name);
            onFile(file);
            return false;
        }, children: [_jsx("p", { className: "ant-upload-drag-icon", children: _jsx(InboxOutlined, {}) }), _jsx("p", { className: "ant-upload-text", children: label }), fileName ? (_jsxs("p", { className: "ant-upload-hint", children: [_jsx(CheckCircleFilled, { style: { color: '#16A34A', marginRight: 6 } }), _jsx(Text, { style: { color: '#16A34A', fontSize: 13 }, children: fileName })] })) : (_jsx("p", { className: "ant-upload-hint", children: hint ?? `Перетащите файл или нажмите для выбора — ${accept}` }))] }));
}
