import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Space, Steps, Typography } from 'antd';
import {
  ShopOutlined, SlidersOutlined, BulbOutlined, AppstoreOutlined, PlayCircleOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { tokens } from '../../theme';

/** Fire from anywhere (header button, dashboard onboarding) to open the guided tour. */
export function openDemoTour() {
  window.dispatchEvent(new Event('wso:tour'));
}

const STEPS = [
  {
    icon: <ShopOutlined />, title: 'Загрузите склад', path: '/warehouses',
    body: 'Начните с реальных данных: на странице «Склады» выберите пример (обувной склад, онлайн-ритейл или продуктовые корзины) и нажмите «Загрузить». Через несколько секунд появится активный склад.',
  },
  {
    icon: <SlidersOutlined />, title: 'Запустите скоринг', path: '/scoring',
    body: 'На «Скоринге» подберите веса (скорость, co-pick, вместимость) и нажмите «Запустить». Увидите назначения, распределение прироста и три метрики валидации (WAPE, стабильность, эффективность маршрута с доверительным интервалом).',
  },
  {
    icon: <BulbOutlined />, title: 'Примите рекомендации', path: '/recommendations',
    body: 'Система покажет только статистически значимые перестановки — с доводами (lift co-pick, перцентиль спроса) и числами. Примите по одной или «Принять все» — товары реально переедут в новые ячейки.',
  },
  {
    icon: <AppstoreOutlined />, title: 'Постройте маршрут', path: '/map',
    body: 'На «Карте склада» выберите товары и постройте маршрут пикера — он рисуется прямо на схеме. Режим «До / после» наглядно показывает, сколько метров экономит перестановка.',
  },
  {
    icon: <PlayCircleOutlined />, title: 'Оцените экономию', path: '/simulation',
    body: 'На «Симуляции» прогоните историю заказов на предложенном размещении — честная оценка экономии пути и времени до внедрения.',
  },
];

export function DemoTour() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handler = () => { setStep(0); setOpen(true); };
    window.addEventListener('wso:tour', handler);
    if (!localStorage.getItem('wso.tourSeen')) {
      const t = setTimeout(() => { setStep(0); setOpen(true); }, 900);
      return () => { clearTimeout(t); window.removeEventListener('wso:tour', handler); };
    }
    return () => window.removeEventListener('wso:tour', handler);
  }, []);

  const close = () => { setOpen(false); localStorage.setItem('wso.tourSeen', '1'); };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal
      open={open}
      onCancel={close}
      width={560}
      title={<Space><span style={{ color: tokens.primary }}>{s.icon}</span> Демо-тур · {s.title}</Space>}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button type="text" onClick={close}>Пропустить</Button>
          <Space>
            {step > 0 && <Button onClick={() => setStep(step - 1)}>Назад</Button>}
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => { navigate(s.path); if (last) close(); else setStep(step + 1); }}
            >
              {last ? `Открыть «${s.title}» и завершить` : `Открыть и далее`}
            </Button>
          </Space>
        </div>
      }
    >
      <Steps
        size="small"
        current={step}
        onChange={setStep}
        style={{ marginBottom: 18 }}
        items={STEPS.map(x => ({ title: '', icon: x.icon }))}
      />
      <Typography.Paragraph style={{ fontSize: 14, marginBottom: 0 }}>{s.body}</Typography.Paragraph>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Шаг {step + 1} из {STEPS.length} — нажмите «Открыть», чтобы перейти в раздел.
      </Typography.Text>
    </Modal>
  );
}
