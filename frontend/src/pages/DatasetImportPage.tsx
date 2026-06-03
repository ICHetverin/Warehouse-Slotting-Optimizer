import { useState, useEffect } from 'react';
import {
  Alert, Button, Card, Col, Form, Input, Row,
  Select, Space, Steps, Tag, Typography,
} from 'antd';
import { CheckCircleFilled, InfoCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
// import { useNavigate } from 'react-router-dom';
import { DropZone } from '../components/Upload/DropZone';
import { api } from '../api/client';
import type { Warehouse } from '../types';

const { Title, Paragraph, Text } = Typography;

// ── Типы ─────────────────────────────────────────────────────────────────────

type StepKey = 'warehouse' | 'support' | 'locations' | 'products' | 'orders' | 'strategy' | 'done';

const STEP_KEYS: StepKey[] = ['warehouse', 'support', 'locations', 'products', 'orders', 'strategy', 'done'];
const STEP_TITLES           = ['Склад', 'Депо', 'Ячейки', 'Артикулы', 'Заказы', 'Стратегия', 'Готово'];

interface Result { label: string; count: number; extra?: string }

// ── Компонент описания формата ────────────────────────────────────────────────

function FormatBox({ title, columns, example, note }: {
  title:   string;
  columns: { name: string; type: string; desc: string }[];
  example: string;
  note?:   string;
}) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 16, background: '#fafafa', border: '1px solid #f0f0f0' }}
      title={<Text style={{ fontSize: 12, fontWeight: 600, color: '#595959' }}>{title}</Text>}
    >
      <div style={{ marginBottom: 8 }}>
        {columns.map(c => (
          <div key={c.name} style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
            <Tag style={{ fontSize: 11, margin: 0, fontFamily: 'monospace', minWidth: 140 }}>{c.name}</Tag>
            <Text style={{ fontSize: 11, color: '#8c8c8c', minWidth: 70 }}>{c.type}</Text>
            <Text style={{ fontSize: 12 }}>{c.desc}</Text>
          </div>
        ))}
      </div>
      <Text code style={{ fontSize: 11, display: 'block', whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '6px 8px', borderRadius: 4 }}>
        {example}
      </Text>
      {note && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 12, marginTop: 2 }} />
          <Text style={{ fontSize: 12, color: '#595959' }}>{note}</Text>
        </div>
      )}
    </Card>
  );
}

// ── Основная страница ─────────────────────────────────────────────────────────

export function DatasetImportPage() {
  // const navigate = useNavigate();

  const [step, setStep]             = useState<StepKey>('warehouse');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWh, setSelectedWh] = useState<number | null>(null);
  const [newWhName, setNewWhName]   = useState('');
  const [results, setResults]       = useState<Result[]>([]);
  const [dockInfo, setDockInfo]     = useState<{ row: number; col: number } | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    api.listWarehouses().then(r => setWarehouses(r.data)).catch(() => {});
  }, []);

  const currentIdx = STEP_KEYS.indexOf(step);

  const ok = (label: string, count: number, extra?: string) => {
    setResults(prev => [...prev, { label, count, extra }]);
    setError(null);
    setLoading(false);
  };
  const fail = (msg: string) => { setError(msg); setLoading(false); };

  // ── Создание склада ──────────────────────────────────────────────────────
  const handleWarehouse = async () => {
    if (selectedWh) { setStep('support'); return; }
    if (!newWhName.trim()) { setError('Введите название склада'); return; }
    setLoading(true);
    try {
      const res = await api.createWarehouse({
        name: newWhName.trim(), rows: 200, columns: 60,
        dockX: 0, dockY: 0, aisleWidthM: 1.5,
      });
      setSelectedWh(res.data.id);
      setWarehouses(prev => [...prev, res.data]);
      setStep('support');
    } catch { fail('Не удалось создать склад'); }
    finally { setLoading(false); }
  };

  // ── Универсальная загрузка файла ─────────────────────────────────────────
  const upload = async (
    file:    File,
    fn:      (wid: number, f: File) => Promise<{ data: { imported?: number; assigned?: number } }>,
    label:   string,
    next:    StepKey,
    extraFn?: (data: Record<string, number>) => void,
  ) => {
    if (!selectedWh) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fn(selectedWh, file) as { data: Record<string, number> };
      const count = res.data.imported ?? res.data.assigned ?? 0;
      extraFn?.(res.data);
      ok(label, count);
      setStep(next);
    } catch (e: unknown) {
      fail(e instanceof Error ? e.message : 'Ошибка загрузки');
    }
  };

  const uploadSupportPoints = (file: File) =>
    upload(
      file,
      async (wid, f) => {
        const r = await api.importSupportPoints(wid, f);
        return { data: r.data as Record<string, number> };
      },
      'Навигационные точки',
      'locations',
      (data) => setDockInfo({ row: data.dockRow, col: data.dockCol }),
    );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px' }}>
      <Title level={3} style={{ marginBottom: 4 }}>Импорт датасета склада</Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Загрузите файлы из реального датасета обувного производства. Каждый шаг показывает
        ожидаемый формат файла и пример данных.
      </Paragraph>

      <Steps
        current={currentIdx}
        size="small"
        items={STEP_TITLES.map((title, i) => ({
          title,
          status: (i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait') as
            'finish' | 'process' | 'wait',
        }))}
        style={{ marginBottom: 32 }}
      />

      {/* Результаты */}
      {results.length > 0 && (
        <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 24 }}>
          {results.map((r, i) => (
            <Space key={i} size={8}>
              <CheckCircleFilled style={{ color: '#16A34A' }} />
              <Text style={{ fontSize: 13 }}>
                {r.label}: <Text strong>{r.count.toLocaleString('ru-RU')}</Text> записей
                {r.extra && <Text style={{ color: '#8c8c8c' }}> — {r.extra}</Text>}
              </Text>
            </Space>
          ))}
        </Space>
      )}

      {error && (
        <Alert type="error" message={error} showIcon closable
          onClose={() => setError(null)} style={{ marginBottom: 16 }} />
      )}

      {/* ── Шаг 1: Склад ──────────────────────────────────────────────── */}
      {step === 'warehouse' && (
        <Card title="1. Выбрать или создать склад">
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            Склад будет создан с размерами по умолчанию (200×60). Координаты депо
            обновятся автоматически после загрузки Support_Points.csv.
          </Paragraph>
          <Form layout="vertical">
            {warehouses.length > 0 && (
              <Form.Item label="Существующие склады">
                <Select
                  placeholder="— создать новый —"
                  value={selectedWh ?? undefined}
                  onChange={(v: number | undefined) => setSelectedWh(v ?? null)}
                  allowClear
                  options={warehouses.map(w => ({ label: `${w.name} (ID: ${w.id})`, value: w.id }))}
                />
              </Form.Item>
            )}
            {!selectedWh && (
              <Form.Item label="Название нового склада">
                <Input
                  placeholder="например Footwear Warehouse Z1"
                  value={newWhName}
                  onChange={e => setNewWhName(e.target.value)}
                  onPressEnter={handleWarehouse}
                />
              </Form.Item>
            )}
            <Button type="primary" block loading={loading} onClick={handleWarehouse}>
              {selectedWh ? 'Продолжить' : 'Создать и продолжить'}
            </Button>
          </Form>
        </Card>
      )}

      {/* ── Шаг 2: Support_Points.csv ─────────────────────────────────── */}
      {step === 'support' && (
        <Card title="2. Support_Points.csv — навигационные точки и депо">
          <FormatBox
            title="Ожидаемые колонки"
            columns={[
              { name: 'points_specified', type: 'string', desc: 'Координаты точки: (x, y, z) в сантиметрах' },
              { name: 'labels',           type: 'string', desc: 'Метка точки: LC-01, CC-02, RC-03 ...' },
            ]}
            example={`points_specified\tlabels\n(66.0, -29.0, 1.0)\tLC-01\n(403.0, -29.0, 1.0)\tCC-01\n(66.0, 61.0, 1.0)\tLC-02`}
            note="Депо определяется автоматически как центр точек с минимальным y (вход склада). Значение y = −29 → смещается до 0."
          />
          <DropZone
            label="Перетащите Support_Points.csv"
            hint="points_specified, labels"
            disabled={loading}
            onFile={uploadSupportPoints}
          />
          {dockInfo && (
            <Alert
              type="success"
              style={{ marginTop: 12 }}
              message={
                <Text>Депо определено: <Text strong>row={dockInfo.row}, col={dockInfo.col}</Text></Text>
              }
            />
          )}
        </Card>
      )}

      {/* ── Шаг 3: Storage_Location.csv ───────────────────────────────── */}
      {step === 'locations' && (
        <Card title="3. Storage_Location.csv — ячейки склада">
          <FormatBox
            title="Ожидаемые колонки"
            columns={[
              { name: 'originalLocation', type: 'string',  desc: 'Метка ячейки: A-14-11 (зона-стеллаж-позиция)' },
              { name: 'position',         type: 'string',  desc: 'Конкатенация координат (не используется)' },
              { name: 'x',               type: 'integer', desc: 'Координата X в сантиметрах → col = x ÷ 10' },
              { name: 'y',               type: 'integer', desc: 'Координата Y в сантиметрах → row = (y + 29) ÷ 10' },
              { name: 'z',               type: 'integer', desc: 'Уровень ячейки: 1, 2, 3' },
            ]}
            example={`originalLocation\tposition\tx\ty\tz\nA-14-11\t368, 0, 1\t368\t0\t1\nA-14-12\t352, 0, 1\t352\t0\t1\nA-14-21\t368, 0, 2\t368\t0\t2`}
            note="Зона определяется автоматически из первой буквы метки: A из A-14-11. Грузоподъёмность по умолчанию = 50 кг."
          />
          <DropZone
            label="Перетащите Storage_Location.csv"
            hint="originalLocation, position, x, y, z"
            disabled={loading}
            onFile={f => upload(f, (wid, file) => api.importStorageLocations(wid, file), 'Ячейки', 'products')}
          />
        </Card>
      )}

      {/* ── Шаг 4: Product.csv ────────────────────────────────────────── */}
      {step === 'products' && (
        <Card title="4. Product.csv — каталог артикулов">
          <FormatBox
            title="Ожидаемые колонки"
            columns={[
              { name: 'Reference', type: 'string', desc: 'Уникальный код артикула: TQBVRI' },
              { name: 'ABCCOD',    type: 'string', desc: 'ABC-класс: A (быстрый), B (средний), C (медленный)' },
              { name: 'Sector',    type: 'string', desc: 'Зона склада: Z1, Z2, Z3 (не обязательно)' },
            ]}
            example={`Reference\tABCCOD\tSector\nTQBVRI\tA\tZ1\nXYZABC\tB\tZ2\nDEFGHI\tC\tZ1`}
            note={
              'Вес артикула определяется по ABC-классу: A = 0.35 кг, B = 0.55 кг, C = 0.80 кг. ' +
              'В датасете реальный вес отсутствует.'
            }
          />
          <DropZone
            label="Перетащите Product.csv"
            hint="Reference, ABCCOD, Sector"
            disabled={loading}
            onFile={f => upload(f, (wid, file) => api.importProducts(wid, file), 'Артикулы', 'orders')}
          />
        </Card>
      )}

      {/* ── Шаг 5: Customer_Order.csv ─────────────────────────────────── */}
      {step === 'orders' && (
        <Card title="5. Customer_Order.csv — история заказов">
          <FormatBox
            title="Ожидаемые колонки"
            columns={[
              { name: 'codCustomer',       type: 'string',   desc: 'ID клиента (не используется)' },
              { name: 'orderNumber',       type: 'integer',  desc: 'Номер заказа — ключ группировки строк' },
              { name: 'orderToCollect',    type: 'integer',  desc: 'Порядковый номер сборки (не используется)' },
              { name: 'Reference',         type: 'string',   desc: 'Код артикула — должен быть в Product.csv' },
              { name: 'Size (US)',         type: 'float',    desc: 'Размер обуви: 9.5 (не используется для привязки)' },
              { name: 'quantity (units)',  type: 'integer',  desc: 'Количество единиц в строке заказа' },
              { name: 'creationDate',      type: 'datetime', desc: 'Дата создания: формат dd/MM/yyyy HH:mm' },
              { name: 'waveNumber',        type: 'integer',  desc: 'Номер волны сборки (не используется)' },
              { name: 'operator',          type: 'string',   desc: 'Код оператора (не используется)' },
            ]}
            example={`codCustomer\torderNumber\torderToCollect\tReference\tSize (US)\tquantity (units)\tcreationDate\twaveNumber\toperator\nCUST001\t12345\t1\tTQBVRI\t9.5\t2\t19/10/2023 07:18\t1\tOP01`}
            note="Все строки с одинаковым orderNumber объединяются в один заказ. Reference без учёта размера."
          />
          <DropZone
            label="Перетащите Customer_Order.csv"
            hint="orderNumber, Reference, quantity (units), creationDate, ..."
            disabled={loading}
            onFile={f => upload(f, (wid, file) => api.importCustomerOrders(wid, file), 'Заказы', 'strategy')}
          />
        </Card>
      )}

      {/* ── Шаг 6: Storage Strategy (опционально) ─────────────────────── */}
      {step === 'strategy' && (
        <Card title="6. *_Storage.csv — начальное размещение (опционально)">
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
            Загрузите один из файлов стратегии хранения. Это установит текущего владельца
            каждой ячейки (Slot.currentSku) — базовое состояние до оптимизации.
          </Paragraph>

          <Row gutter={8} style={{ marginBottom: 12 }}>
            {['Class_Based_Storage.csv', 'Dedicated_Storage.csv', 'Hybrid_Storage.csv', 'Random_Storage.csv'].map(f => (
              <Col key={f}><Tag style={{ fontSize: 11 }}>{f}</Tag></Col>
            ))}
          </Row>

          <FormatBox
            title="Ожидаемые колонки"
            columns={[
              { name: 'Location / originalLocation', type: 'string', desc: 'Метка ячейки: A-14-11' },
              { name: 'ABCCOD / XYZCOD',             type: 'string', desc: 'Класс хранения (не используется)' },
              { name: 'col_1 .. col_18',             type: 'string', desc: 'Артикул;количество: TQBVRI;7' },
            ]}
            example={`Location\tABCCOD\tcol_1\tcol_2\tcol_3\nA-14-11\tA\tTQBVRI;7\tXYZABC;3\t\nA-14-12\tA\tDEFGHI;12\t\t`}
            note="Берётся артикул с максимальным количеством в строке как основной для ячейки. Остальные игнорируются."
          />

          <DropZone
            label="Перетащите *_Storage.csv"
            hint="Location/originalLocation, col_1..col_18 (формат: code;qty)"
            disabled={loading}
            onFile={f => upload(f, (wid, file) => api.importStorageStrategy(wid, file) as Promise<{ data: { imported?: number; assigned?: number } }>, 'Назначения ячеек', 'done')}
          />

          <Button
            type="link"
            style={{ padding: 0, marginTop: 8, fontSize: 13 }}
            onClick={() => setStep('done')}
          >
            Пропустить этот шаг →
          </Button>
        </Card>
      )}

      {/* ── Шаг 7: Готово ─────────────────────────────────────────────── */}
      {step === 'done' && (
        <Card title="Данные загружены!">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Paragraph style={{ marginBottom: 8 }}>
              Датасет импортирован в склад <Text strong>ID: {selectedWh}</Text>.
              Теперь можно запустить скоринг и получить рекомендации по оптимизации.
            </Paragraph>
            <Row gutter={12}>
              <Col>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  href={`/scoring`}
                >
                  Запустить скоринг
                </Button>
              </Col>
              <Col>
                <Button href={`/recommendations?wid=${selectedWh}`}>
                  Смотреть рекомендации
                </Button>
              </Col>
              <Col>
                <Button href={`/map`}>
                  Карта склада
                </Button>
              </Col>
            </Row>
          </Space>
        </Card>
      )}
    </div>
  );
}
