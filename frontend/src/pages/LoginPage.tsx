import { useState } from 'react';
import { Button, Card, Form, Input, Typography, Alert, Space } from 'antd';
import { AppstoreOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const { Title, Text } = Typography;

interface LocationState { from?: { pathname: string } }

export function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/warehouses';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (e: unknown) {
      const msg = extractError(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 380 }} styles={{ body: { padding: 32 } }}>
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 8 }}>
          <AppstoreOutlined style={{ color: '#1677ff', fontSize: 28 }} />
          <Title level={4} style={{ margin: 0 }}>Вход в систему</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>Оптимизатор склада</Text>
        </Space>

        {error && <Alert type="error" message={error} showIcon style={{ margin: '16px 0' }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} style={{ marginTop: 16 }}>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="you@company.com" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="••••••" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Войти
          </Button>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
          </Text>
        </div>
      </Card>
    </div>
  );
}

function extractError(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const resp = (e as { response?: { data?: { error?: { message?: string } } } }).response;
    if (resp?.data?.error?.message) return resp.data.error.message;
  }
  return 'Не удалось войти';
}
