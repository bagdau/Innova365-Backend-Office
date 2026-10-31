import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

type Status = { state: 'unconfigured' | 'active' | 'expired'; paidUntil: string | null; remainingMs: number | null; serverTime: string };
type Snapshot = { status: Status; receivedAt: number };
function readSnapshot(key: string): Snapshot | null {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null') as Snapshot | null;
    return value && Number.isFinite(value.receivedAt) && value.status?.serverTime ? value : null;
  } catch { return null; }
}

export default function BillingStatus() {
  const [tick, setTick] = useState(0);
  const restaurantId = useAuthStore((st) => st.user?.restauranteId);
  const storageKey = `innova365-billing-${restaurantId}`;
  const [cached, setCached] = useState<Snapshot | null>(() => readSnapshot(storageKey));
  useEffect(() => setCached(readSnapshot(storageKey)), [storageKey]);
  const { data, isLoading, isError } = useQuery({ queryKey: ['billing-status', restaurantId], enabled: !!restaurantId,
    queryFn: async () => {
      const snapshot = { status: (await api.get<Status>('/billing/status')).data, receivedAt: Date.now() };
      try { localStorage.setItem(storageKey, JSON.stringify(snapshot)); } catch { /* счётчик всё равно покажет ответ сервера */ }
      setCached(snapshot);
      return snapshot;
    },
    refetchInterval: 60_000, retry: 1 });
  useEffect(() => { const timer = window.setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(timer); }, []);
  void tick;
  const shown = data ?? cached;
  const remaining = shown?.status.remainingMs == null ? null : Math.max(0, shown.status.remainingMs - Math.max(0, Date.now() - shown.receivedAt));
  const days = remaining == null ? null : Math.floor(remaining / 86_400_000);
  const hours = remaining == null ? null : Math.floor((remaining % 86_400_000) / 3_600_000);
  return <div className="bg-card border border-border rounded-l p-6 space-y-2">
    <h3 className="text-base font-semibold text-foreground">Оплата приложения</h3>
    {isLoading && !shown && <p className="text-sm text-muted-foreground">Загрузка…</p>}
    {isError && !shown && <p className="text-sm text-muted-foreground">Не удалось обновить срок оплаты</p>}
    {shown && <>
      {shown.status.state === 'unconfigured' && <p className="text-sm text-muted-foreground">Срок оплаты пока не указан</p>}
      {(shown.status.state === 'expired' || remaining === 0) && <p className="text-sm text-error">Оплаченный срок закончился</p>}
      {shown.status.state === 'active' && remaining !== 0 && <p className="text-sm text-foreground">Осталось {days} дн. {hours} ч.</p>}
      {shown.status.paidUntil && <p className="text-sm text-muted-foreground">Оплачено до {new Date(shown.status.paidUntil).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Qyzylorda' })}</p>}
      {isError && <p className="text-xs text-muted-foreground">Показаны сохранённые данные</p>}
    </>}
  </div>;
}
