import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout } from './components/layout/AuthLayout';
import { useAuthStore } from './store/authStore';
import { LiveSync } from './components/LiveSync';
import { VirtualKeyboard } from './components/shared/VirtualKeyboard';
import { CommandPalette } from './components/CommandPalette';
import { can, homeFor, type RouteKey } from './auth/permissions';

import LoginPage from './pages/auth/LoginPage';
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const MesasPage = lazy(() => import('./pages/mesas/MesasPage'));
const NuevoPedidoPage = lazy(() => import('./pages/pedidos/NuevoPedidoPage'));
const HistorialPage = lazy(() => import('./pages/pedidos/HistorialPage'));
const CocinaPage = lazy(() => import('./pages/cocina/CocinaPage'));
const MenuPage = lazy(() => import('./pages/menu/MenuPage'));
const InventarioPage = lazy(() => import('./pages/inventario/InventarioPage'));
const ReportesPage = lazy(() => import('./pages/reportes/ReportesPage'));
const CajaPage = lazy(() => import('./pages/caja/CajaPage'));
const UsuariosPage = lazy(() => import('./pages/usuarios/UsuariosPage'));
const ConfiguracionPage = lazy(() => import('./pages/configuracion/ConfiguracionPage'));
const PerfilPage = lazy(() => import('./pages/perfil/PerfilPage'));
const NotificacionesPage = lazy(() => import('./pages/notificaciones/NotificacionesPage'));
const OnboardingPage = lazy(() => import('./pages/onboarding/OnboardingPage'));
const NotFoundPage = lazy(() => import('./pages/errors/NotFoundPage'));
const MeseroPage = lazy(() => import('./pages/mesero/MeseroPage'));
const MonitorPage = lazy(() => import('./pages/monitor/MonitorPage'));
const AuditoriaPage = lazy(() => import('./pages/auditoria/AuditoriaPage'));

function ProtectedRoute({ children, route }: { children: JSX.Element; route?: RouteKey }) {
  const { user, accessToken } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  if (route && !can(user.rol, route)) return <Navigate to={homeFor(user.rol)} replace />;
  return children;
}

function AuthGuard({ children }: { children: JSX.Element }) {
  const { accessToken, user } = useAuthStore();
  if (accessToken && user) return <Navigate to={homeFor(user.rol)} replace />;
  return children;
}

function RootRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={homeFor(user?.rol)} replace />;
}

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <>
    <LiveSync />
    <VirtualKeyboard />
    <CommandPalette />
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Public */}
      <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/403" element={<NotFoundPage />} />

      {/* Cocina (sin sidebar) */}
      <Route path="/cocina" element={
        <ProtectedRoute route="cocina">
          <CocinaPage />
        </ProtectedRoute>
      } />

      {/* Vista móvil mesero (sin sidebar) */}
      <Route path="/mesero" element={
        <ProtectedRoute route="mesero">
          <MeseroPage />
        </ProtectedRoute>
      } />

      {/* Authenticated layout */}
      <Route element={<ProtectedRoute><AuthLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={
          <ProtectedRoute route="dashboard">
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/mesas" element={
          <ProtectedRoute route="mesas">
            <MesasPage />
          </ProtectedRoute>
        } />
        <Route path="/pedidos" element={
          <ProtectedRoute route="pedidos">
            <HistorialPage />
          </ProtectedRoute>
        } />
        <Route path="/pedidos/nuevo" element={
          <ProtectedRoute route="pedidosNuevo">
            <NuevoPedidoPage />
          </ProtectedRoute>
        } />
        <Route path="/menu" element={
          <ProtectedRoute route="menu">
            <MenuPage />
          </ProtectedRoute>
        } />
        <Route path="/inventario" element={
          <ProtectedRoute route="inventario">
            <InventarioPage />
          </ProtectedRoute>
        } />
        <Route path="/reportes" element={
          <ProtectedRoute route="reportes">
            <ReportesPage />
          </ProtectedRoute>
        } />
        <Route path="/caja" element={
          <ProtectedRoute route="caja">
            <CajaPage />
          </ProtectedRoute>
        } />
        <Route path="/monitor" element={
          <ProtectedRoute route="monitor">
            <MonitorPage />
          </ProtectedRoute>
        } />
        <Route path="/auditoria" element={
          <ProtectedRoute route="auditoria">
            <AuditoriaPage />
          </ProtectedRoute>
        } />
        <Route path="/usuarios" element={
          <ProtectedRoute route="usuarios">
            <UsuariosPage />
          </ProtectedRoute>
        } />
        <Route path="/configuracion" element={
          <ProtectedRoute route="configuracion">
            <ConfiguracionPage />
          </ProtectedRoute>
        } />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/notificaciones" element={<NotificacionesPage />} />
      </Route>

      {/* Redirects */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </>
  );
}
