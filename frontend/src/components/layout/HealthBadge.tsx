import { useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { api } from '../../api/client';
import { tokens } from '../../theme';

/** Small API health indicator in the header (polls GET /health). */
export function HealthBadge() {
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const ping = () => api.health().then(() => alive && setUp(true)).catch(() => alive && setUp(false));
    void ping();
    const t = setInterval(ping, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const color = up == null ? tokens.textTertiary : up ? tokens.success : tokens.error;
  const text = up == null ? 'Проверка API…' : up ? 'API на связи' : 'API недоступен';

  return (
    <Tooltip title={text}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${color}22` }} />
        <span style={{ fontSize: 12, color: tokens.textTertiary }}>API</span>
      </span>
    </Tooltip>
  );
}
