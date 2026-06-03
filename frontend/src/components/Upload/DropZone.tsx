import { useRef, useState } from 'react';
import { Typography } from 'antd';
import { CheckCircleFilled, InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  label:     string;
  accept?:   string;
  hint?:     string;
  onFile:    (file: File) => void;
  disabled?: boolean;
}

/**
 * Нативный drag-and-drop компонент для выбора одного файла.
 * Не зависит от antd Upload — работает стабильно во всех версиях.
 */
export function DropZone({ label, accept = '.csv', hint, onFile, disabled }: Props) {
  const [dragging,  setDragging]  = useState(false);
  const [fileName,  setFileName]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    onFile(file);
  };

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDragging(true);  };
  const onDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (!disabled) setDragging(true);  };
  const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // сброс, чтобы можно было выбрать тот же файл повторно
  };

  const borderColor = dragging ? '#1677ff' : '#d9d9d9';
  const background  = dragging ? '#e6f4ff' : '#fafafa';

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border:       `2px dashed ${borderColor}`,
        borderRadius: 8,
        padding:      '32px 20px',
        textAlign:    'center',
        background,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        transition:   'border-color 0.2s, background 0.2s',
        opacity:      disabled ? 0.55 : 1,
        userSelect:   'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onInputChange}
        style={{ display: 'none' }}
      />

      <div style={{ fontSize: 40, color: fileName ? '#16A34A' : dragging ? '#1677ff' : '#8c8c8c', marginBottom: 8 }}>
        {fileName
          ? <CheckCircleFilled />
          : <InboxOutlined />}
      </div>

      {fileName ? (
        <>
          <Text strong style={{ display: 'block', color: '#16A34A', fontSize: 14, marginBottom: 4 }}>
            {fileName}
          </Text>
          <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
            Файл выбран — нажмите для замены
          </Text>
        </>
      ) : (
        <>
          <Text strong style={{ display: 'block', fontSize: 14, color: '#262626', marginBottom: 4 }}>
            {label}
          </Text>
          <Text style={{ color: '#8c8c8c', fontSize: 12 }}>
            {hint ?? `Перетащите файл или нажмите — ${accept}`}
          </Text>
        </>
      )}
    </div>
  );
}
