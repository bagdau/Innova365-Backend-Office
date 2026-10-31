import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../services/api';

type Device = { id: string; installationId: string; createdAt: string; lastSeenAt: string; revokedAt: string | null };
type Status = { configured: boolean; devices: Device[] };

export default function DesktopActivation() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['desktop-activation'], queryFn: () => api.get<Status>('/desktop/activation').then((r) => r.data) });
  const rotate = useMutation({
    mutationFn: () => api.post<{ code: string }>('/desktop/activation').then((r) => r.data),
    onSuccess: (result) => { setCode(result.code); void qc.invalidateQueries({ queryKey: ['desktop-activation'] }); },
    onError: () => toast.error('Не удалось создать код'),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/desktop/devices/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['desktop-activation'] }); toast.success('Устройство отключено'); },
    onError: () => toast.error('Не удалось отключить устройство'),
  });

  return <div className="bg-card border border-border rounded-l p-6 space-y-6">
    <div>
      <h3 className="text-base font-semibold text-foreground mb-2">Активация приложения</h3>
      <p className="text-sm text-muted-foreground mb-4">Этот код привязывает установленную кассу к вашему ресторану.</p>
      <button className="bg-primary text-white rounded-m px-4 py-2 disabled:opacity-50" disabled={rotate.isPending || isLoading}
        onClick={() => { if (data?.configured && !window.confirm('Создать новый код? Прежний код перестанет активировать новые устройства.')) return; rotate.mutate(); }}>
        {data?.configured ? 'Создать новый код' : 'Создать код'}
      </button>
      {code && <div className="mt-4 p-4 bg-muted border border-border rounded-m max-w-sm">
        <div className="text-sm text-muted-foreground mb-2">Код активации</div>
        <div className="font-mono text-2xl font-semibold tracking-wider select-all">{code}</div>
        <button className="text-primary text-sm mt-3" onClick={() => void navigator.clipboard.writeText(code).then(() => toast.success('Код скопирован')).catch(() => toast.error('Не удалось скопировать'))}>Скопировать</button>
      </div>}
    </div>
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">Устройства</h3>
      {!data?.devices.length && <p className="text-sm text-muted-foreground">Нет активированных устройств</p>}
      <div className="space-y-2">{data?.devices.map((device) => <div key={device.id} className="flex items-center gap-3 p-3 bg-muted rounded-m">
        <div className="min-w-0 flex-1"><div className="font-mono text-xs text-foreground truncate">{device.installationId}</div><div className="text-xs text-muted-foreground">{device.revokedAt ? 'Отключено' : `Активировано ${new Date(device.createdAt).toLocaleDateString('ru-RU')}`}</div></div>
        {!device.revokedAt && <button className="text-sm text-error" disabled={revoke.isPending} onClick={() => { if (window.confirm('Отключить это устройство?')) revoke.mutate(device.id); }}>Отключить</button>}
      </div>)}</div>
    </div>
  </div>;
}
