import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import { Logo } from '../../components/shared/Logo';
import { ThemeSwitcher } from '../../components/shared/ThemeSwitcher';
import { SoundToggle } from '../../components/shared/SoundToggle';
import { KeyboardToggle } from '../../components/shared/KeyboardToggle';
import { playSound } from '../../sound';
import { homeFor } from '../../auth/permissions';
import { t, apiError } from '../../i18n';

const schema = z.object({
  email: z.string().email(t('Email inválido')).optional(),
  password: z.string().optional(),
  pin: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [error, setError] = useState('');

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    if (loginMode === 'pin' && !/^\d{4}$/.test(data.pin ?? '')) { setError(t('Введите PIN из 4 цифр')); return; }
    if (loginMode === 'password' && (!data.email || !data.password)) { setError(t('Укажите email и пароль')); return; }
    try {
      const res = loginMode === 'pin'
        ? await authService.loginPin(data.pin!)
        : await authService.login(data.email!, data.password!);
      setAuth(res.user, res.accessToken);
      playSound('login');
      navigate(homeFor(res.user.rol));
    } catch (e: any) {
      playSound('error');
      setError(apiError(e, 'Error al iniciar sesión'));
    }
  };

  return (
    <div className="min-h-[100dvh] flex">
      {/* Left Panel */}
      <div
        className="hidden lg:flex flex-col justify-center px-16 w-1/2"
        style={{
          background: 'linear-gradient(135deg, #E8590C 0%, #8B2500 50%, #0F0F0F 100%)',
        }}
      >
        <div className="bg-white rounded-2xl px-8 py-6 mb-10 self-start shadow-xl">
          <img src="/logo-full.png" alt="Innova365 POS" className="h-20 w-auto" draggable={false} />
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight mb-4">
          {t('Sistema de')}<br />{t('Gestión')}<br />{t('Inteligente')}
        </h1>
        <p className="text-white/60 text-sm tracking-widest uppercase">
          {t('Pedidos · Inventario · Reportes · Cocina')}
        </p>
      </div>

      {/* Right Panel */}
      <div className="relative flex-1 flex items-center justify-center px-8 bg-background">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />
          <SoundToggle />
          <KeyboardToggle />
        </div>
        <div className="w-full max-w-md">
          <Logo size={44} className="lg:hidden mb-6 flex justify-center w-full" />
          <div className="bg-card border border-border rounded-l p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground">{t('Iniciar Sesión')}</h2>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-m bg-muted p-1 mb-5" role="group" aria-label={t('Способ входа')}>
              <button type="button" aria-pressed={loginMode === 'password'} onClick={() => { setLoginMode('password'); setError(''); setValue('pin', ''); }}
                className={`rounded-m px-3 py-2 text-sm font-semibold transition-colors ${loginMode === 'password' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{t('Пароль')}</button>
              <button type="button" aria-pressed={loginMode === 'pin'} onClick={() => { setLoginMode('pin'); setError(''); setValue('email', undefined); setValue('password', ''); }}
                className={`rounded-m px-3 py-2 text-sm font-semibold transition-colors ${loginMode === 'pin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{t('PIN-код')}</button>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 bg-error-bg border border-error/20 rounded-m px-3 py-2.5 text-sm text-error">
                <TriangleAlert size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {loginMode === 'password' && <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('Correo electrónico')}</label>
                <input
                  type="email"
                  placeholder="admin@restaurante.com"
                  {...register('email')}
                  className="w-full bg-muted border border-border rounded-m px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
                {errors.email && <p className="text-xs text-error mt-1">{errors.email.message}</p>}
              </div>}
              {loginMode === 'pin' && <div>
                <label htmlFor="login-pin" className="block text-sm font-medium text-foreground mb-1.5">{t('PIN-код — 4 цифры')}</label>
                <input id="login-pin" type="password" inputMode="numeric" data-vkb-im="pin" pattern="[0-9]{4}" maxLength={4} autoComplete="off"
                  placeholder="••••" {...register('pin')}
                  className="w-full bg-muted border border-border rounded-m px-3 py-2.5 text-center text-xl tracking-[0.55em] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors" />
              </div>}

              {loginMode === 'password' && <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('Contraseña')}</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    className="w-full bg-muted border border-border rounded-m px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-error mt-1">{errors.password.message}</p>}
              </div>}

              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                {loginMode === 'pin' ? t('Войти по PIN') : t('Ingresar al Sistema')}
              </Button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
