import { lazy, Suspense, ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity, ArrowLeftRight, Download, FileUp, Search, Lock, BellRing, LineChart, FileSignature, FileText, Home, CalendarDays, Landmark, PiggyBank, Percent, UserSquare2, Banknote, Waves, BarChart3, BookOpenCheck, Boxes, ClipboardCheck, Eye, Factory, Package, Trash2, TrendingUp, UtensilsCrossed, Building2, CalendarCheck2, ChefHat, ClipboardList, Coins, FileClock, Handshake, KeyRound, LayoutDashboard, LogOut, Menu, Moon,
  Receipt, Settings, ShieldCheck, ShieldX, Store, Sun, Truck, Users, Wallet, X,
} from 'lucide-react';
import { AuthProvider, Perm, useAuth } from './auth';
import { Loading, UiProvider } from './ui';
import { ReminderBell } from './Reminders';
import { CommandPalette } from './CommandPalette';
import { LangSwitch } from './LangSwitch';
import { BookOpen } from 'lucide-react';
import Login from './pages/Login';
import { TwoFactor } from './pages/Profile';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Outlets = lazy(() => import('./pages/Outlets'));
const FcRevenue = lazy(() => import('./pages/FcRevenue'));
const Settlements = lazy(() => import('./pages/Settlements'));
const SettlementPrint = lazy(() => import('./pages/SettlementPrint'));
const TechCards = lazy(() => import('./pages/TechCards'));
const TechCardEditor = lazy(() => import('./pages/TechCardEditor'));
const TechCardPrint = lazy(() => import('./pages/TechCardPrint'));
const Ingredients = lazy(() => import('./pages/Ingredients'));
const Revenue = lazy(() => import('./pages/Revenue'));
const ZReport = lazy(() => import('./pages/ZReport'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Pnl = lazy(() => import('./pages/Pnl'));
const StockValue = lazy(() => import('./pages/StockValue'));
const Staff = lazy(() => import('./pages/Staff'));
const Audit = lazy(() => import('./pages/Audit'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Profile = lazy(() => import('./pages/Profile'));
const Guide = lazy(() => import('./pages/Guide'));
const Roles = lazy(() => import('./pages/Roles'));
const StockOverview = lazy(() => import('./pages/StockOverview'));
const Movements = lazy(() => import('./pages/Movements'));
const Stocktakes = lazy(() => import('./pages/Stocktakes'));
const StocktakeCount = lazy(() => import('./pages/StocktakeCount'));
const Writeoffs = lazy(() => import('./pages/Writeoffs'));
const StocktakePrint = lazy(() => import('./pages/InventoryPrint').then((m) => ({ default: m.StocktakePrint })));
const WriteoffPrint = lazy(() => import('./pages/InventoryPrint').then((m) => ({ default: m.WriteoffPrint })));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const SupplierCard = lazy(() => import('./pages/SupplierCard'));
const SupplierPrices = lazy(() => import('./pages/SupplierExtras').then((m) => ({ default: m.SupplierPrices })));
const ReconciliationPrint = lazy(() => import('./pages/SupplierExtras').then((m) => ({ default: m.ReconciliationPrint })));
const MenuPrices = lazy(() => import('./pages/MenuPrices'));
const StaffControl = lazy(() => import('./pages/StaffControl'));
const SystemPage = lazy(() => import('./pages/SystemPage'));
const ImportPage = lazy(() => import('./pages/Import'));
const Security = lazy(() => import('./pages/Security'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Leases = lazy(() => import('./pages/Leases'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoicePrint = lazy(() => import('./pages/Invoices').then((m) => ({ default: m.InvoicePrint })));
const TenantHome = lazy(() => import('./pages/TenantHome'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Cashflow = lazy(() => import('./pages/Cashflow'));
const Budget = lazy(() => import('./pages/Budget'));
const Tax = lazy(() => import('./pages/Tax'));
const Employees = lazy(() => import('./pages/Employees'));
const Timesheet = lazy(() => import('./pages/Timesheet'));
const Payroll = lazy(() => import('./pages/Payroll'));
const PayrollDetail = lazy(() => import('./pages/Payroll').then((m) => ({ default: m.PayrollDetail })));
const PayrollPrint = lazy(() => import('./pages/Payroll').then((m) => ({ default: m.PayrollPrint })));

interface NavItem { to: string; label: string; icon: typeof Menu; perm?: Perm | Perm[] }
const allowed = (can: (p: Perm) => boolean, p?: Perm | Perm[]) => (p === undefined ? true : Array.isArray(p) ? p.some(can) : can(p));
const NAV: { title: string; items: NavItem[] }[] = [
  { title: 'Обзор', items: [{ to: '/', label: 'Панель', icon: LayoutDashboard, perm: 'dashboard' }, { to: '/', label: 'Моя точка', icon: Home, perm: 'tenant' }] },
  { title: 'Склад', items: [
    { to: '/inventory/stock', label: 'Остатки и заказ', icon: Package, perm: 'inv.view' },
    { to: '/inventory/stocktakes', label: 'Инвентаризация', icon: ClipboardCheck, perm: 'inv.view' },
    { to: '/inventory/writeoffs', label: 'Списания', icon: Trash2, perm: 'inv.view' },
    { to: '/inventory/movements', label: 'Движение товаров', icon: ArrowLeftRight, perm: 'inv.view' },
  ] },
  { title: 'Закупки', items: [
    { to: '/suppliers', label: 'Поставщики', icon: Factory, perm: 'sup.view' },
    { to: '/supplier-prices', label: 'Цены сырья', icon: TrendingUp, perm: 'sup.view' },
  ] },
  { title: 'Меню', items: [{ to: '/menu', label: 'Меню и цены', icon: UtensilsCrossed, perm: 'menu.view' }] },
  { title: 'Фудкорт', items: [
    { to: '/foodcourt/outlets', label: 'Точки', icon: Store, perm: 'fc.view' },
    { to: '/foodcourt/revenue', label: 'Выручка по точкам', icon: BarChart3, perm: 'fc.view' },
    { to: '/foodcourt/settlements', label: 'Взаиморасчёты', icon: Handshake, perm: 'fc.view' },
    { to: '/foodcourt/leases', label: 'Договоры аренды', icon: FileSignature, perm: 'fc.view' },
    { to: '/foodcourt/invoices', label: 'Счета и акты', icon: FileText, perm: 'fc.view' },
  ] },
  { title: 'Технологи', items: [
    { to: '/techcards', label: 'Техкарты', icon: ChefHat, perm: 'tc.view' },
    { to: '/ingredients', label: 'Сырьё и цены', icon: Boxes, perm: 'tc.view' },
  ] },
  { title: 'Бухгалтерия', items: [
    { to: '/accounting/revenue', label: 'Выручка', icon: Coins, perm: 'acc.view' },
    { to: '/accounting/zreport', label: 'Z-отчёт (день)', icon: CalendarCheck2, perm: 'acc.view' },
    { to: '/accounting/expenses', label: 'Расходы', icon: Receipt, perm: 'acc.view' },
    { to: '/accounting/purchases', label: 'Закупки и долги', icon: Truck, perm: 'acc.view' },
    { to: '/accounting/pnl', label: 'ОПУ (прибыль)', icon: BookOpenCheck, perm: 'acc.view' },
    { to: '/accounting/stock', label: 'Склад в деньгах', icon: Wallet, perm: 'acc.view' },
  ] },
  { title: 'Финансы', items: [
    { to: '/finance/accounts', label: 'Счета и деньги', icon: Landmark, perm: 'fin.view' },
    { to: '/finance/cashflow', label: 'Движение денег (ДДС)', icon: Waves, perm: 'fin.view' },
    { to: '/finance/budget', label: 'Бюджет', icon: PiggyBank, perm: 'fin.view' },
    { to: '/finance/tax', label: 'Налоги (оценка)', icon: Percent, perm: 'fin.view' },
  ] },
  { title: 'Персонал', items: [
    { to: '/hr/employees', label: 'Штат', icon: UserSquare2, perm: 'hr.view' },
    { to: '/hr/timesheet', label: 'Табель', icon: CalendarDays, perm: 'hr.view' },
    { to: '/hr/payroll', label: 'Зарплата', icon: Banknote, perm: 'hr.view' },
  ] },
  { title: 'Отчёты', items: [{ to: '/reports', label: 'Аналитика', icon: LineChart, perm: 'rep.view' }] },
  { title: 'Данные', items: [{ to: '/import', label: 'Импорт из Excel', icon: FileUp, perm: ['ing.edit', 'ing.cost', 'sup.edit', 'menu.edit'] }] },
  { title: 'Контроль', items: [{ to: '/control/staff', label: 'Сотрудники зала', icon: Eye, perm: 'ctl.view' }] },
  { title: 'Помощь', items: [{ to: '/guide', label: 'Инструктаж', icon: BookOpen }] },
  { title: 'Администрирование', items: [
    { to: '/admin/staff', label: 'Сотрудники', icon: Users, perm: 'staff' },
    { to: '/admin/roles', label: 'Права доступа', icon: ShieldCheck, perm: 'roles' },
    { to: '/admin/audit', label: 'Журнал действий', icon: FileClock, perm: 'audit' },
    { to: '/admin/security', label: 'Безопасность', icon: Lock, perm: ['staff', 'audit'] },
    { to: '/admin/notifications', label: 'Уведомления', icon: BellRing, perm: ['notify', 'rep.schedule'] },
    { to: '/admin/system', label: 'Система', icon: Activity, perm: ['sys.view', 'sys.backup'] },
    { to: '/admin/settings', label: 'Настройки', icon: Settings, perm: 'settings' },
  ] },
];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UiProvider>
          <Root />
        </UiProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function Root() {
  const { me, loading, can } = useAuth();
  if (loading) return <div className="grid h-full place-items-center"><Loading text="Подключение…" /></div>;
  if (!me) return <Login />;
  if (me.twofa.must) return <MustSetup />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* печатные формы — без боковой панели */}
        <Route path="/print/settlement/:id" element={<Guard perm="fc.view"><SettlementPrint /></Guard>} />
        <Route path="/print/techcard/:id" element={<Guard perm="tc.view"><TechCardPrint /></Guard>} />
 <Route path="/print/my-settlement/:id" element={<Guard perm="tenant"><SettlementPrint tenant /></Guard>} />
        <Route path="/print/my-invoice/:id" element={<Guard perm="tenant"><InvoicePrint tenant /></Guard>} />
        <Route path="/print/invoice/:id" element={<Guard perm="fc.view"><InvoicePrint /></Guard>} />
        <Route path="/print/stocktake/:id" element={<Guard perm="inv.view"><StocktakePrint /></Guard>} />
        <Route path="/print/writeoff/:id" element={<Guard perm="inv.view"><WriteoffPrint /></Guard>} />
 <Route path="/print/payroll/:id" element={<Guard perm="hr.view"><PayrollPrint /></Guard>} />
        <Route path="/print/reconciliation/:id" element={<Guard perm="sup.view"><ReconciliationPrint /></Guard>} />
        <Route element={<Shell />}>
          <Route index element={can('tenant') ? <TenantHome /> : <Guard perm="dashboard"><Dashboard /></Guard>} />
          <Route path="foodcourt/leases" element={<Guard perm="fc.view"><Leases /></Guard>} />
          <Route path="foodcourt/invoices" element={<Guard perm="fc.view"><Invoices /></Guard>} />
          <Route path="foodcourt/outlets" element={<Guard perm="fc.view"><Outlets /></Guard>} />
          <Route path="foodcourt/revenue" element={<Guard perm="fc.view"><FcRevenue /></Guard>} />
          <Route path="foodcourt/settlements" element={<Guard perm="fc.view"><Settlements /></Guard>} />
          <Route path="foodcourt/settlements/:id" element={<Guard perm="fc.view"><Settlements /></Guard>} />
          <Route path="inventory/stock" element={<Guard perm="inv.view"><StockOverview /></Guard>} />
          <Route path="inventory/stocktakes" element={<Guard perm="inv.view"><Stocktakes /></Guard>} />
          <Route path="inventory/stocktakes/:id" element={<Guard perm="inv.view"><StocktakeCount /></Guard>} />
          <Route path="inventory/writeoffs" element={<Guard perm="inv.view"><Writeoffs /></Guard>} />
          <Route path="inventory/movements" element={<Guard perm="inv.view"><Movements /></Guard>} />
          <Route path="suppliers" element={<Guard perm="sup.view"><Suppliers /></Guard>} />
          <Route path="suppliers/:id" element={<Guard perm="sup.view"><SupplierCard /></Guard>} />
          <Route path="supplier-prices" element={<Guard perm="sup.view"><SupplierPrices /></Guard>} />
          <Route path="finance/accounts" element={<Guard perm="fin.view"><Accounts /></Guard>} />
          <Route path="finance/cashflow" element={<Guard perm="fin.view"><Cashflow /></Guard>} />
          <Route path="finance/budget" element={<Guard perm="fin.view"><Budget /></Guard>} />
          <Route path="finance/tax" element={<Guard perm="fin.view"><Tax /></Guard>} />
          <Route path="hr/employees" element={<Guard perm="hr.view"><Employees /></Guard>} />
          <Route path="hr/timesheet" element={<Guard perm="hr.view"><Timesheet /></Guard>} />
          <Route path="hr/payroll" element={<Guard perm="hr.view"><Payroll /></Guard>} />
          <Route path="hr/payroll/:id" element={<Guard perm="hr.view"><PayrollDetail /></Guard>} />
          <Route path="reports" element={<Guard perm="rep.view"><Reports /></Guard>} />
          <Route path="admin/notifications" element={<Guard perm={['notify', 'rep.schedule']}><Notifications /></Guard>} />
          <Route path="import" element={<Guard perm={['ing.edit', 'ing.cost', 'sup.edit', 'menu.edit']}><ImportPage /></Guard>} />
          <Route path="menu" element={<Guard perm="menu.view"><MenuPrices /></Guard>} />
          <Route path="control/staff" element={<Guard perm="ctl.view"><StaffControl /></Guard>} />
          <Route path="admin/system" element={<Guard perm={['sys.view', 'sys.backup']}><SystemPage /></Guard>} />
          <Route path="techcards" element={<Guard perm="tc.view"><TechCards /></Guard>} />
          <Route path="techcards/:id" element={<Guard perm="tc.view"><TechCardEditor /></Guard>} />
          <Route path="ingredients" element={<Guard perm="tc.view"><Ingredients /></Guard>} />
          <Route path="accounting/revenue" element={<Guard perm="acc.view"><Revenue /></Guard>} />
          <Route path="accounting/zreport" element={<Guard perm="acc.view"><ZReport /></Guard>} />
          <Route path="accounting/expenses" element={<Guard perm="acc.view"><Expenses /></Guard>} />
          <Route path="accounting/purchases" element={<Guard perm="acc.view"><Purchases /></Guard>} />
          <Route path="accounting/pnl" element={<Guard perm="acc.view"><Pnl /></Guard>} />
          <Route path="accounting/stock" element={<Guard perm="acc.view"><StockValue /></Guard>} />
          <Route path="admin/staff" element={<Guard perm="staff"><Staff /></Guard>} />
 <Route path="admin/security" element={<Guard perm={['staff', 'audit']}><Security /></Guard>} />
          <Route path="admin/roles" element={<Guard perm="roles"><Roles /></Guard>} />
          <Route path="admin/audit" element={<Guard perm="audit"><Audit /></Guard>} />
          <Route path="admin/settings" element={<Guard perm="settings"><SettingsPage /></Guard>} />
          <Route path="profile" element={<Profile />} />
          <Route path="guide" element={<Guide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function MustSetup() {
  const { me, logout } = useAuth();
  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="mb-5 flex items-center justify-between"><div className="text-lg font-semibold">Innova <span className="text-brand">Office</span> · {me!.name}</div><button className="btn btn-ghost btn-sm" onClick={() => void logout()}><LogOut size={16} /> Выйти</button></div>
      <TwoFactor mustSetup />
    </div>
  );
}

function Guard({ perm, children }: { perm: Perm | Perm[]; children: ReactNode }) {
  const { can } = useAuth();
  if (!allowed(can, perm)) {
    return (
      <div className="mx-auto mt-24 max-w-md text-center"><ShieldX size={42} className="mx-auto mb-3 text-muted/50" /><h2 className="text-lg font-semibold">Нет доступа</h2>
        <p className="mt-1 text-sm text-muted">Этот раздел недоступен для вашей роли. Если он нужен для работы — обратитесь к администратору.</p></div>
    );
  }
  return <>{children}</>;
}

/* ───────── Каркас: боковая панель + шапка ───────── */
function Shell() {
  const { me, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState(false);
  const [install, setInstall] = useState<{ prompt: () => Promise<void>; userChoice: Promise<unknown> } | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstall(e as unknown as { prompt: () => Promise<void>; userChoice: Promise<unknown> }); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('office-theme') === 'dark' ? 'dark' : 'light'));
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('office-theme', theme); }, [theme]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setFind((v) => !v); }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(can, i.perm)) })).filter((g) => g.items.length);

  return (
    <div className="flex h-full">
      {open && <div className="no-print fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[2px] lg:hidden animate-fade" onClick={() => setOpen(false)} />}
      <aside className={clsx('no-print fixed inset-y-0 left-0 z-50 flex w-[268px] max-w-[86vw] flex-col bg-side text-slate-300 transition-transform lg:static lg:z-auto lg:translate-x-0', open ? 'translate-x-0 animate-slide' : '-translate-x-full')}>
        <div className="flex h-16 shrink-0 items-center gap-3 px-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-900/40"><Building2 size={19} /></div>
          <div className="leading-tight"><div className="text-[15px] font-semibold tracking-tight text-white">Innova <span className="text-indigo-300">Office</span></div><div className="text-[10px] uppercase tracking-[.18em] text-slate-500">учётный офис</div></div>
          <button className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">{g.title}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition', isActive ? 'bg-indigo-500/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                  <i.icon size={17} className="shrink-0" />{i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <NavLink to="/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-500/25 text-sm font-semibold text-indigo-200">{initials(me!.name)}</div>
            <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-[13px] font-medium text-white">{me!.name}</div><div className="truncate text-[11px] text-slate-500">{me!.roleLabel}</div></div>
          </NavLink>
        </div>
      </aside>

      <CommandPalette open={find} onClose={() => setFind(false)} pages={groups.flatMap((g) => g.items.map((i) => ({ to: i.to, label: i.label, group: g.title, icon: i.icon })))} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur sm:px-6">
          <button className="btn btn-ghost !px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Меню"><Menu size={20} /></button>
          <div className="min-w-0 flex-1 truncate text-sm text-muted">{me!.settings.company || 'Innova365'} · <span className="text-ink">{me!.roleLabel}</span></div>
          <button className="btn btn-ghost btn-sm !px-2 sm:!px-3" onClick={() => setFind(true)} title="Поиск (Ctrl+K)"><Search size={17} /><span className="hidden text-muted md:inline">Поиск</span><kbd className="hidden rounded border border-line px-1 text-[10px] text-muted lg:inline">Ctrl K</kbd></button>
          <LangSwitch />
          {install && <button className="btn btn-soft btn-sm hidden sm:inline-flex" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download size={15} /> Установить</button>}
          {!can('tenant') && <ReminderBell />}
          <button className="btn btn-ghost btn-sm !px-2" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Тема">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          {me!.role !== 'owner' && me!.role !== 'admin' && <NavLink to="/profile" className="btn btn-ghost btn-sm !px-2" title="Пароль"><KeyRound size={17} /></NavLink>}
          <button className="btn btn-ghost btn-sm" onClick={() => void logout()}><LogOut size={16} /><span className="hidden sm:inline">Выйти</span></button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1360px] p-4 sm:p-6"><Suspense fallback={<Loading />}><Outlet /></Suspense></div></main>
      </div>
    </div>
  );
}

const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
export { ClipboardList };
