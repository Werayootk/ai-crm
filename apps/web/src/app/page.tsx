import { HealthStatus } from './health-status';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', paddingBlock: 48 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>AI CRM</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>Phase 1 — ตรวจการเชื่อมต่อระบบ</p>
      <HealthStatus />
    </main>
  );
}
