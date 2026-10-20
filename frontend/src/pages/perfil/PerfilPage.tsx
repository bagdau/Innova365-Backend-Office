import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import { ThemeSwitcher } from '../../components/shared/ThemeSwitcher';
import { SoundToggle } from '../../components/shared/SoundToggle';
import { KeyboardToggle } from '../../components/shared/KeyboardToggle';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { reportesService } from '../../services/reportes.service';
import { getInitials, rolLabel, rolColor, formatDate } from '../../utils/cn';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';
import { t, apiError } from '../../i18n';

export default function PerfilPage() {
  const { user, logout, setUser } = useAuthStore();
  const navigate = useNavigate();
  const { data: rest } = useQuery<{ nombre: string }>({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });

  const { register: regInfo, handleSubmit: handleInfo, formState: { isSubmitting: savingInfo } } = useForm({
    defaultValues: { nombre: user?.nombre ?? '', email: user?.email ?? '' },
  });

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { isSubmitting: savingPwd } } = useForm({
    defaultValues: { passwordActual: '', passwordNuevo: '', confirmar: '' },
  });

  const saveInfo = useMutation({
    mutationFn: (data: { nombre: string; email: string }) => reportesService.updatePerfil(data),
    onSuccess: (updated) => {
      if (setUser) setUser({ ...user!, nombre: updated.nombre, email: updated.email });
      toast.success(t('Perfil actualizado'));
    },
    onError: (e: any) => toast.error(apiError(e, 'Error al guardar')),
  });

  const savePwd = useMutation({
    mutationFn: (data: { passwordActual: string; passwordNuevo: string }) => reportesService.changePassword(data),
    onSuccess: () => { resetPwd(); toast.success(t('Contraseña actualizada')); },
    onError: (e: any) => toast.error(apiError(e, 'Error al cambiar contraseña')),
  });

  const handlePwdSubmit = (data: any) => {
    if (data.passwordNuevo !== data.confirmar) { toast.error(t('Las contraseñas no coinciden')); return; }
    savePwd.mutate({ passwordActual: data.passwordActual, passwordNuevo: data.passwordNuevo });
  };

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
    toast.success(t('Sesión cerrada'));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-5xl">
      {/* Карточка пользователя: на телефоне — горизонтальная, на десктопе — колонка слева */}
      <div className="lg:w-72 lg:flex-shrink-0 space-y-4">
        <div className="bg-card border border-border rounded-l p-4 sm:p-6 flex flex-row lg:flex-col items-center gap-4 lg:gap-3 text-left lg:text-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 flex-shrink-0 rounded-pill bg-primary/20 flex items-center justify-center text-xl lg:text-2xl font-bold text-primary">
            {user ? getInitials(user.nombre) : '?'}
          </div>
          <div className="min-w-0 flex-1 lg:flex-none">
            <p className="font-semibold text-foreground text-base truncate">{user?.nombre}</p>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mt-1', user ? rolColor(user.rol) : '')}>
              {user ? rolLabel(user.rol) : ''}
            </span>
          </div>
          <div className="hidden sm:block text-xs text-muted-foreground space-y-1 lg:w-full lg:text-left text-right">
            <p>{rest?.nombre ?? user?.restaurante?.nombre}</p>
            {user?.creadoEn && <p>{t('Desde')} {formatDate(user.creadoEn)}</p>}
          </div>
        </div>
      </div>

      {/* Right Forms */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Интерфейс: на телефоне эти настройки убраны из шапки */}
        <div className="bg-card border border-border rounded-l p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('Interfaz')}</h3>
          <div className="flex flex-wrap items-center gap-4"><LanguageSwitcher /><ThemeSwitcher /><SoundToggle /><KeyboardToggle /></div>
        </div>

        {/* Info personal */}
        <div className="bg-card border border-border rounded-l p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('Información personal')}</h3>
          <form onSubmit={handleInfo((d) => saveInfo.mutate(d))} className="space-y-4 sm:max-w-sm">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Nombre')}</label>
              <input autoComplete="name" {...regInfo('nombre', { required: true })} className="w-full bg-muted border border-border rounded-m px-3 py-2.5 sm:py-2 text-base sm:text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Email')}</label>
              <input type="email" autoComplete="email" inputMode="email" {...regInfo('email', { required: true })} className="w-full bg-muted border border-border rounded-m px-3 py-2.5 sm:py-2 text-base sm:text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>
            <Button type="submit" className="w-full sm:w-auto" loading={savingInfo || saveInfo.isPending}>{t('Guardar cambios')}</Button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div className="bg-card border border-border rounded-l p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t('Cambiar contraseña')}</h3>
          <form onSubmit={handlePwd(handlePwdSubmit)} className="space-y-4 sm:max-w-sm">
            {[
              { name: 'passwordActual', label: t('Contraseña actual') },
              { name: 'passwordNuevo', label: t('Nueva contraseña') },
              { name: 'confirmar', label: t('Confirmar contraseña') },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
                <input type="password" autoComplete={name === 'passwordActual' ? 'current-password' : 'new-password'} {...regPwd(name as any, { required: true })}
                  className="w-full bg-muted border border-border rounded-m px-3 py-2.5 sm:py-2 text-base sm:text-sm text-foreground focus:outline-none focus:border-primary" />
              </div>
            ))}
            <Button type="submit" variant="secondary" className="w-full sm:w-auto" loading={savingPwd || savePwd.isPending}>{t('Cambiar contraseña')}</Button>
          </form>
        </div>

        <div>
          <Button variant="danger" className="w-full sm:w-auto" onClick={handleLogout}><LogOut size={15} /> {t('Cerrar sesión')}</Button>
        </div>
      </div>
    </div>
  );
}
