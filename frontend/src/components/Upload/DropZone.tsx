import { useCallback, useState } from 'react';

interface Props {
  label: string;
  accept?: string;
  hint?: string;
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function DropZone({ label, accept = '.csv', hint, onFile, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handle = useCallback((file: File) => {
    setFileName(file.name);
    onFile(file);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  }, [handle]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
  };

  return (
    <label
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors select-none',
        disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed text-gray-400'
          : dragging
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-gray-300 bg-white hover:border-brand-500 hover:bg-brand-50 text-gray-600',
      ].join(' ')}
    >
      <svg className="h-8 w-8 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>

      <span className="font-medium text-sm">{label}</span>

      {fileName ? (
        <span className="text-xs text-green-600 font-medium">{fileName}</span>
      ) : (
        <span className="text-xs text-gray-400">{hint ?? `Drag & drop or click — ${accept}`}</span>
      )}

      <input type="file" accept={accept} className="hidden" disabled={disabled} onChange={onInputChange} />
    </label>
  );
}
