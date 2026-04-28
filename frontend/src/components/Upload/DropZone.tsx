import { useState } from 'react';
import { Upload, Typography } from 'antd';
import { InboxOutlined, CheckCircleFilled } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  label: string;
  accept?: string;
  hint?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ label, accept = '.csv', hint, onFile, disabled }: Props) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <Upload.Dragger
      accept={accept}
      disabled={disabled}
      showUploadList={false}
      beforeUpload={(file) => {
        setFileName(file.name);
        onFile(file);
        return false;
      }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">{label}</p>
      {fileName ? (
        <p className="ant-upload-hint">
          <CheckCircleFilled style={{ color: '#16A34A', marginRight: 6 }} />
          <Text style={{ color: '#16A34A', fontSize: 13 }}>{fileName}</Text>
        </p>
      ) : (
        <p className="ant-upload-hint">{hint ?? `Drag & drop or click — ${accept}`}</p>
      )}
    </Upload.Dragger>
  );
}
