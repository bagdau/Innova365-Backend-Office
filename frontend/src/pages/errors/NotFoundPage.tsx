import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import { homeFor } from '../../auth/permissions';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { t } from '../../i18n';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-center gap-4">
      <div className="w-20 h-20 rounded-pill bg-muted flex items-center justify-center">
        <UtensilsCrossed size={36} className="text-primary" />
      </div>
      <h1 className="text-8xl font-bold text-primary">404</h1>
      <h2 className="text-xl font-semibold text-foreground">{t('Mesa no encontrada')}</h2>
      <p className="text-muted-foreground max-w-sm">{t('La página que buscas no está en nuestra carta.')}</p>
      <Button onClick={() => navigate(homeFor(useAuthStore.getState().user?.rol))} className="mt-2">{t('Volver al inicio')}</Button>
    </div>
  );
}
