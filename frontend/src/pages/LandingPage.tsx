import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Col, Row, Space, Steps, Tag, Typography, message,
} from 'antd';
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  NodeIndexOutlined,
  PartitionOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { api } from '../api/client';

const { Title, Paragraph, Text } = Typography;

const FEATURES = [
  {
    icon:   <ThunderboltOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
    title:  'Скоринговый движок',
    desc:   'Скорость продаж × расстояние + совместные заказы + нагрузка. Три компонента, одна прозрачная формула. Веса настраиваются вручную.',
    tags:   ['Жадное назначение', 'Матрица совм. заказов', 'Velocity Score'],
    color:  '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    icon:   <NodeIndexOutlined style={{ fontSize: 28, color: '#F97316' }} />,
    title:  'Оптимизатор маршрута',
    desc:   'Строит граф склада через JGraphT и решает задачу TSP — точно для ≤12 остановок, ближайший сосед + 2-opt для больших списков.',
    tags:   ['JGraphT', 'TSP', 'До / После'],
    color:  '#FFF7ED',
    border: '#FED7AA',
  },
  {
    icon:   <BulbOutlined style={{ fontSize: 28, color: '#7C3AED' }} />,
    title:  'Объяснимость',
    desc:   'Каждая рекомендация объясняет конкретную причину: «Совместный заказ с SKU-A22 (43% заказов), на 12 м ближе к докингу». Никаких чёрных ящиков.',
    tags:   ['Причины + цифры', 'Принять / Отклонить', 'Экономия в день'],
    color:  '#F5F3FF',
    border: '#DDD6FE',
  },
];

const HOW_IT_WORKS = [
  {
    title:       'Загрузите данные',
    description: 'Загрузите CSV файлы с планировкой склада, каталогом артикулов и историей заказов. Занимает меньше минуты.',
  },
  {
    title:       'Запустите скоринг',
    description: 'Движок вычисляет скорость продаж, аффинити совместных заказов и дистанционные оценки — затем назначает артикулы на оптимальные ячейки.',
  },
  {
    title:       'Просматривайте и принимайте',
    description: 'Каждая рекомендация обоснована — простым языком и конкретными цифрами. Принять или отклонить — один клик.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);

  const tryDemo = async () => {
    setSeeding(true);
    try {
      const res = await api.seedDemo();
      message.success(`Демо-склад загружен (ID: ${res.data.warehouseId}) — используйте его на любой странице`);
      navigate(`/recommendations?wid=${res.data.warehouseId}`);
    } catch {
      message.error('Не удалось загрузить демо-данные — запущен ли бэкенд?');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* ── Шапка ─────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 100, background: '#fff' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 24px',
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Space>
            <AppstoreOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            <Text strong style={{ fontSize: 15 }}>Оптимизатор склада</Text>
          </Space>
          <Space>
            <Button onClick={() => navigate('/upload')}>Начать</Button>
            <Button type="primary" loading={seeding} onClick={tryDemo}>
              Попробовать демо
            </Button>
          </Space>
        </div>
      </header>

      {/* ── Герой ─────────────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(160deg, #f0f5ff 0%, #fafafa 60%, #fff 100%)', padding: '80px 24px 96px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Tag color="blue" style={{ marginBottom: 20, fontSize: 12 }}>
            Прозрачно · Формульно · Без чёрного ящика
          </Tag>

          <Title
            level={1}
            style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.2, marginBottom: 20, fontWeight: 700 }}
          >
            Слоттинг склада, который{' '}
            <span style={{ color: '#1677ff' }}>показывает свою работу</span>
          </Title>

          <Paragraph style={{ fontSize: 18, color: '#595959', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
            Каждая рекомендация сопровождается формулой, графом и числами, которые за ней стоят.
            Создано для операционных команд, которым нужно обосновывать решения — не просто принимать их.
          </Paragraph>

          <Space size={12} wrap style={{ justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate('/upload')}
              style={{ height: 44, paddingInline: 28, fontSize: 15 }}
            >
              Начать работу
            </Button>
            <Button
              size="large"
              loading={seeding}
              onClick={tryDemo}
              style={{ height: 44, paddingInline: 28, fontSize: 15 }}
            >
              Попробовать демо — без загрузки данных
            </Button>
          </Space>

          <div style={{ marginTop: 32, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['JGraphT', 'Матрица совм. заказов', 'Жадный TSP', 'Объяснимость', 'React + Spring Boot'].map(t => (
              <Tag key={t} style={{ fontSize: 12 }}>{t}</Tag>
            ))}
          </div>
        </div>
      </section>

      {/* ── Три слоя ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Title level={2} style={{ marginBottom: 8 }}>Три слоя — одна цель</Title>
            <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 0 }}>
              Скоринг → Маршрутизация → Объяснимость. Каждый слой открыт — изучайте, настраивайте, проверяйте.
            </Paragraph>
          </div>
          <Row gutter={[24, 24]}>
            {FEATURES.map(f => (
              <Col key={f.title} xs={24} md={8}>
                <Card
                  style={{ height: '100%', border: `1px solid ${f.border}`, background: f.color }}
                  styles={{ body: { padding: '28px 24px' } }}
                >
                  <div style={{ marginBottom: 16 }}>{f.icon}</div>
                  <Title level={4} style={{ marginTop: 0, marginBottom: 10 }}>{f.title}</Title>
                  <Paragraph style={{ color: '#595959', fontSize: 14, marginBottom: 16 }}>
                    {f.desc}
                  </Paragraph>
                  <Space wrap size={6}>
                    {f.tags.map(t => (
                      <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>
                    ))}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* ── Цитата ────────────────────────────────────────────────────────── */}
      <section style={{ background: '#1677ff', padding: '56px 24px', textAlign: 'center' }}>
        <Title level={3} style={{ color: '#fff', marginBottom: 8, fontWeight: 600 }}>
          «Вот граф, вот маршрут, вот формула — проверь сам.»
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 0 }}>
          Создано для менеджеров склада, которых подвели AI-решения в чёрном ящике.
        </Paragraph>
      </section>

      {/* ── Как работает ──────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <Title level={2} style={{ marginBottom: 8 }}>Как это работает</Title>
            <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 0 }}>
              От сырых CSV до рекомендаций — за 30 секунд.
            </Paragraph>
          </div>
          <Steps
            direction="vertical"
            current={3}
            items={HOW_IT_WORKS.map((s, i) => ({
              title: <Text strong style={{ fontSize: 16 }}>{s.title}</Text>,
              description: (
                <Paragraph style={{ color: '#595959', marginBottom: 0, marginTop: 4 }}>
                  {s.description}
                </Paragraph>
              ),
              icon: (
                <span style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#1677ff', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}>
                  {i + 1}
                </span>
              ),
            }))}
          />
        </div>
      </section>

      {/* ── Сравнение с конкурентами ───────────────────────────────────────── */}
      <section style={{ padding: '0 24px 72px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
            Почему не Excel?
          </Title>
          <Row gutter={[16, 16]}>
            {[
              { label: 'Красивый дашборд, математики нет', name: 'SlotWise', bad: true },
              { label: '6 месяцев внедрения, консультанты, $$$$', name: 'Manhattan', bad: true },
              { label: 'Открытые формулы, граф, объяснимость', name: 'Этот инструмент', bad: false },
            ].map(c => (
              <Col key={c.name} xs={24} md={8}>
                <Card
                  style={{
                    border:     c.bad ? '1px solid #f0f0f0' : '2px solid #1677ff',
                    background: c.bad ? '#fafafa' : '#EFF6FF',
                  }}
                  styles={{ body: { padding: '20px 20px' } }}
                >
                  <Text strong style={{ fontSize: 14, color: c.bad ? '#595959' : '#1677ff', display: 'block', marginBottom: 8 }}>
                    {c.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: c.bad ? '#8c8c8c' : '#262626' }}>
                    {c.label}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* ── Финальный призыв ──────────────────────────────────────────────── */}
      <section style={{ background: '#fafafa', borderTop: '1px solid #f0f0f0', padding: '72px 24px', textAlign: 'center' }}>
        <Title level={2} style={{ marginBottom: 12 }}>Готовы оптимизировать?</Title>
        <Paragraph style={{ fontSize: 16, color: '#595959', marginBottom: 32 }}>
          Загрузите данные или сразу перейдите к демо.
        </Paragraph>
        <Space size={12} wrap style={{ justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<PartitionOutlined />}
            onClick={() => navigate('/upload')}
            style={{ height: 44, paddingInline: 28 }}
          >
            Загрузить данные
          </Button>
          <Button
            size="large"
            loading={seeding}
            onClick={tryDemo}
            style={{ height: 44, paddingInline: 28 }}
          >
            Загрузить демо-данные
          </Button>
        </Space>
      </section>

      {/* ── Подвал ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #f0f0f0', padding: '20px 24px', textAlign: 'center' }}>
        <Text style={{ color: '#bfbfbf', fontSize: 12 }}>
          Оптимизатор слоттинга склада · Прозрачные алгоритмы, реальные результаты
        </Text>
      </footer>
    </div>
  );
}
