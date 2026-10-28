import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUiStore } from '../../store/uiStore';
import { useEffect } from 'react';
import { t } from '../../i18n';
import { useQuery } from '@tanstack/react-query';
import { reportesService } from '../../services/reportes.service';
import { setCurrencyCode, currencyCode } from '../../lib/currency';
import { PrintPanel } from '../shared/PrintPanel';

const pageTitles: Record<string, string> = {
  '/dashboard':    t('Dashboard'),
  '/mesas':        t('Gestión de Mesas'),
  '/pedidos':      t('Pedidos'),
  '/pedidos/nuevo':t('Nuevo Pedido'),
  '/cocina':       t('Vista Cocina'),
  '/entregas':     t('Entregas'),
  '/menu':         t('Gestión de Menú'),
  '/techcards':    'Техкарты и остатки',
  '/inventario':   t('Inventario'),
  '/reportes':     t('Reportes'),
  '/caja':         t('Registro de Pago'),
  '/usuarios':     t('Usuarios y Roles'),
  '/monitor':      t('Monitor'),
  '/auditoria':    t('Registro de actividad'),
  '/configuracion':t('Configuración'),
  '/perfil':       t('Mi Perfil'),
  '/notificaciones':t('Notificaciones'),
};

export function AuthLayout() {
  const location  = useLocation();
  const title     = pageTitles[location.pathname] ?? 'Innova365';
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  // Валюта ресторана: применяется сразу; при смене страницы перерисовываются (key), без F5
  const { data: rest } = useQuery<{ moneda?: string }>({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  setCurrencyCode(rest?.moneda);


  // En móvil, cerrar sidebar al cambiar de página
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, [location.pathname]);

  // En desktop, abrir sidebar por defecto al montar
  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true);
  }, []);

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <Sidebar />
      {/* Spacer desktop: empuja el contenido cuando el sidebar está abierto */}
      <div
        className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0'}`}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} />
        <main key={currencyCode()} className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <PrintPanel />
    </div>
  );
}
