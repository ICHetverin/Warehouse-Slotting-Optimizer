import { useEffect, useState } from 'react';
import {
  Button, Card, Col, Empty, Form, Input, Modal, Row, Space, Spin,
  Statistic, Tag, Typography, message,
} from 'antd';
import {
  AppstoreOutlined, PlusOutlined, BulbOutlined, EnvironmentOutlined,
  BarChartOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Warehouse } from '../types';

const { Title, Paragraph, Text } = Typography;

export function WarehousesPage() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [creating, setCreating]     = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.listWarehouses()
      .then(r => setWarehouses(r.data))
      .catch(() => message.error('Не удалось загрузить склады'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async (values: { name: string; rows: number; columns: number }) => {
    setCreating(true);
    try {
      const res = await api.createWarehouse({
        name: values.name.trim(),
        rows: values.rows ?? 25,
        columns: values.columns ?? 20,
        dockX: 0, dockY: 0, aisleWidthM: 1.5,
      });
      message.success(`Склад «${res.data.name}» создан`);
      setModalOpen(false);
      form.resetFields();
      navigate(`/upload?wid=${res.data.id}`);
    } catch {
      message.error('Не удалось создать склад');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 16px' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={3} style={{ marginBottom: 0 }}>
            {isGuest ? 'Демо-склад' : 'Мои склады'}
          </Title>
        </Col>
        {!isGuest && (
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              Создать склад
            </Button>
          </Col>
        )}
      </Row>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        {isGuest
          ? 'Вы в демо-режиме — доступен общий демонстрационный склад. Зарегистрируйтесь, чтобы загрузить свои данные.'
          : 'Здесь только ваши склады. Выберите склад, чтобы перейти к рекомендациям, карте и маршрутам.'}
      </Paragraph>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>
      ) : warehouses.length === 0 ? (
        <Card>
          <Empty
            description={isGuest ? 'Демо-склад ещё не создан' : 'У вас пока нет складов'}
            style={{ padding: 24 }}
          >
            {!isGuest && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                Создать первый склад
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {warehouses.map(wh => (
            <Col key={wh.id} xs={24} md={12}>
              <Card
                hoverable
                onClick={() => navigate(`/recommendations?wid=${wh.id}`)}
                styles={{ body: { padding: 20 } }}
              >
                <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <AppstoreOutlined style={{ color: '#1677ff', fontSize: 20 }} />
                    <div>
                      <Text strong style={{ fontSize: 15 }}>{wh.name}</Text>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>ID: {wh.id}</Text>
                      </div>
                    </div>
                  </Space>
                  {(wh as Warehouse & { demo?: boolean }).demo && <Tag color="blue">демо</Tag>}
                </Space>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Statistic title="Сетка" value={`${wh.rows}×${wh.columns}`} valueStyle={{ fontSize: 16 }} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="Док" value={`${wh.dockX}, ${wh.dockY}`} valueStyle={{ fontSize: 16 }} />
                  </Col>
                </Row>

                <Space size={8} wrap style={{ marginTop: 16 }} onClick={e => e.stopPropagation()}>
                  <Button size="small" icon={<BulbOutlined />} onClick={() => navigate(`/recommendations?wid=${wh.id}`)}>
                    Рекомендации
                  </Button>
                  <Button size="small" icon={<EnvironmentOutlined />} onClick={() => navigate(`/map?wid=${wh.id}`)}>
                    Карта
                  </Button>
                  <Button size="small" icon={<BarChartOutlined />} onClick={() => navigate(`/scoring?wid=${wh.id}`)}>
                    Скоринг
                  </Button>
                  {!isGuest && (
                    <Button size="small" icon={<ThunderboltOutlined />} onClick={() => navigate(`/upload?wid=${wh.id}`)}>
                      Загрузить данные
                    </Button>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Создать склад"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Создать"
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={create} initialValues={{ rows: 25, columns: 20 }}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
            <Input placeholder="например Главный склад — Киев" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rows" label="Рядов"><Input type="number" min={1} /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="columns" label="Колонок"><Input type="number" min={1} /></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
