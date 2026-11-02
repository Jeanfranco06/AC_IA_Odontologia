import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Database,
  ExternalLink,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { CLINIC_BRANCH_OPTIONS, useSidebar } from '@/shared/context/SidebarContext';
import { useTheme } from '@/shared/context/ThemeContext';
import { staffAuthService } from '@/shared/services/staffAuthService';
import { CommandPaletteModal } from './CommandPaletteModal';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import { resolveBreadcrumbs } from './navigationConfig';

type OpenMenuId = 'datamart' | 'quick-settings' | 'notifications' | 'profile' | null;

const INITIAL_NOTIFICATIONS = [
  {
    id: 'n1',
    title: '3 nuevos prospectos en Buyer',
    detail: 'Solicitudes recibidas desde el Portal Web · Sede California',
    time: 'Hace 4 min',
    to: '/buyer',
    unread: true,
  },
  {
    id: 'n2',
    title: 'Comprobante pendiente de validación',
    detail: 'Orden de pago registrada en módulo Payer',
    time: 'Hace 18 min',
    to: '/payer',
    unread: true,
  },
  {
    id: 'n3',
    title: 'Corte analítico actualizado',
    detail: 'Matrices de conversión sincronizadas sin incidencias',
    time: 'Hace 32 min',
    to: '/reportes?tab=all',
    unread: false,
  },
];

export function Header() {
  const { theme } = useTheme();
  const { activeBranch, setActiveBranch, commandOpen, setCommandOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [openMenu, setOpenMenu] = useState<OpenMenuId>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSyncMinutes, setLastSyncMinutes] = useState(2);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [paymentGatewayEnabled, setPaymentGatewayEnabled] = useState(true);

  const menusContainerRef = useRef<HTMLDivElement>(null);

  const session = staffAuthService.getSession();
  const logoSrc = theme === 'dark' ? '/Logo_NexoSalus_Oscuro.png' : '/Logo_NexoSalud.png';

  const displayFullName = session
    ? `${session.nombres} ${session.apellidos}`.trim()
    : 'Dr. Benitez';
  const displayRole = session ? session.rol : 'Administrador';
  const displayEmail = session ? session.email : 'dr.benitez@nexosalud.pe';
  const displayInitials = session ? session.initials : 'DB';

  const breadcrumbs = resolveBreadcrumbs(location.pathname, location.search);
  const unreadCount = notifications.filter((n) => n.unread).length;

  // Cerrar menús al hacer clic fuera o presionar Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        menusContainerRef.current &&
        !menusContainerRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Cerrar menús al cambiar de ruta
  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname, location.search]);

  const toggleMenu = (id: Exclude<OpenMenuId, null>) => {
    setOpenMenu((prev) => (prev === id ? null : id));
  };

  const handleManualSync = async () => {
    setSyncingNow(true);
    await queryClient.invalidateQueries();
    setTimeout(() => {
      setSyncingNow(false);
      setLastSyncMinutes(0);
    }, 450);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleLogout = () => {
    setOpenMenu(null);
    staffAuthService.logout();
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md transition-colors">
        {/* 1. ZONA IZQUIERDA: Botón Mobile Drawer + Breadcrumb Funcional */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Drawer Trigger */}
          <div className="md:hidden">
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir navegación"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
                >
                  <Menu className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex w-72 flex-col border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
              >
                <SheetTitle className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 text-sm font-semibold text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={logoSrc}
                      alt="NexoSalud"
                      className="h-7 w-7 rounded-lg border border-slate-200/80 bg-white object-contain p-0.5"
                    />
                    <div className="flex flex-col text-left">
                      <span className="leading-none">NexoSalud</span>
                      <span className="mt-1 text-[11px] font-normal text-slate-500 leading-none">
                        {activeBranch}
                      </span>
                    </div>
                  </div>
                </SheetTitle>
                <div className="mt-4 flex-1 overflow-y-auto no-scrollbar">
                  <Sidebar forceExpanded={true} onClickItem={() => setMobileSheetOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Breadcrumb Funcional */}
          <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 min-w-0 text-[13px]">
            {breadcrumbs.map((segment, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div key={`${segment.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
                  {index > 0 && (
                    <ChevronRight
                      className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  {isLast || !segment.to ? (
                    <span
                      className={`truncate ${
                        isLast
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'hidden sm:inline font-medium text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {segment.label}
                    </span>
                  ) : (
                    <Link
                      to={segment.to}
                      className="hidden sm:inline truncate font-medium text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
                    >
                      {segment.label}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* 2. ZONA CENTRAL / CONTEXTUAL: Barra de búsqueda global Command-K */}
        <div className="hidden lg:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 px-3 text-left text-[13px] text-slate-400 dark:text-slate-400 transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/20 cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#0f766e] dark:group-hover:text-teal-400 transition-colors"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">Buscar paciente, cita o reporte...</span>
            </span>
            <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* 3. ZONA DERECHA: Barra de Utilidades Coherente y Perfil Enterprise */}
        <div ref={menusContainerRef} className="flex items-center gap-2">
          {/* Botón compacto de búsqueda para pantallas < lg */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            title="Buscar paciente, cita o reporte (⌘K)"
            aria-label="Abrir búsqueda rápida"
            className="inline-flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            <Search className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>

          {/* 3.1 Indicador de conexión / estado del DataMart */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('datamart')}
              aria-expanded={openMenu === 'datamart'}
              title="Estado de sincronización de datos clínicos y analíticos"
              className="hidden sm:inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Sincronizado</span>
              <ChevronDown
                className={`h-3 w-3 text-slate-400 transition-transform duration-150 ${
                  openMenu === 'datamart' ? 'rotate-180 text-slate-700' : ''
                }`}
                strokeWidth={1.75}
              />
            </button>

            <AnimatePresence>
              {openMenu === 'datamart' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-lg z-50"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#0f766e] dark:text-teal-400" strokeWidth={1.75} />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        Estado de Sincronización
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] dark:bg-teal-950/60 px-2 py-0.5 text-[10.5px] font-semibold text-[#065F46] dark:text-teal-300">
                      Activo
                    </span>
                  </div>

                  <dl className="mt-2.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Última actualización</dt>
                      <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        {lastSyncMinutes === 0 ? 'Justo ahora' : `Hace ${lastSyncMinutes} min`}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Latencia de consulta</dt>
                      <dd className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        18 ms
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Cobertura de etapas</dt>
                      <dd className="font-mono font-medium text-slate-800 dark:text-slate-200">
                        5 / 5 módulos
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                    <button
                      type="button"
                      disabled={syncingNow}
                      onClick={handleManualSync}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 text-[#0f766e] ${syncingNow ? 'animate-spin' : ''}`}
                        strokeWidth={1.75}
                      />
                      <span>{syncingNow ? 'Sincronizando vistas…' : 'Actualizar datos ahora'}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3.2 Dropdown de Ajustes Rápidos (Sedes & Métodos de Pago) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('quick-settings')}
              aria-expanded={openMenu === 'quick-settings'}
              title="Ajustes rápidos de sede y terminales de pago"
              aria-label="Ajustes rápidos"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <SlidersHorizontal className="h-[15px] w-[15px]" strokeWidth={1.75} />
            </button>

            <AnimatePresence>
              {openMenu === 'quick-settings' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-lg z-50"
                >
                  <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Sede Operativa Activa
                  </p>
                  <div className="space-y-0.5">
                    {CLINIC_BRANCH_OPTIONS.map((branch) => {
                      const selected = activeBranch === branch.label;
                      return (
                        <button
                          key={branch.id}
                          type="button"
                          onClick={() => {
                            setActiveBranch(branch.label);
                            setOpenMenu(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                            selected
                              ? 'bg-teal-50/70 dark:bg-teal-950/40 font-semibold text-[#0f766e] dark:text-teal-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                            <span>{branch.label}</span>
                          </span>
                          {selected && <Check className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={2} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-2.5 border-t border-slate-100 dark:border-slate-800" />

                  <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                    Recaudación y Terminales
                  </p>
                  <div className="rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                        <CreditCard className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                        <span>Pasarela Tarjetas & Yape</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={paymentGatewayEnabled}
                        onClick={() => setPaymentGatewayEnabled((v) => !v)}
                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          paymentGatewayEnabled ? 'bg-[#0f766e]' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            paymentGatewayEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Conciliación automática activa en el módulo Payer.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3.3 Botón de Notificaciones con badge discreto */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('notifications')}
              aria-expanded={openMenu === 'notifications'}
              title="Notificaciones clínicas y del embudo"
              aria-label="Notificaciones"
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f766e] px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {openMenu === 'notifications' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-lg z-50"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Actividad Reciente
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                      >
                        Marcar leídas
                      </button>
                    )}
                  </div>

                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n))
                          );
                          setOpenMenu(null);
                          navigate(item.to);
                        }}
                        className="flex w-full items-start gap-2.5 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-lg px-2 cursor-pointer"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            item.unread ? 'bg-[#0f766e]' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-slate-400">
                              {item.time}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                            {item.detail}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3.4 Toggle de Tema (Dark/Light Mode) */}
          <ThemeToggle />

          {/* Separador vertical sutil */}
          <div className="mx-0.5 h-5 w-px bg-slate-200/80 dark:bg-slate-800" aria-hidden />

          {/* 3.5 Perfil de Usuario Enterprise con Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('profile')}
              aria-expanded={openMenu === 'profile'}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition-colors duration-150 hover:bg-slate-100/80 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/20 cursor-pointer"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-teal-700 text-xs font-semibold text-white ring-1 ring-slate-200 dark:ring-slate-700">
                {displayInitials}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight max-w-[125px] truncate">
                  {displayFullName}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight max-w-[125px] truncate">
                  {displayRole}
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                  openMenu === 'profile' ? 'rotate-180 text-slate-700' : ''
                }`}
                strokeWidth={1.75}
              />
            </button>

            <AnimatePresence>
              {openMenu === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-1.5 shadow-lg z-50"
                >
                  <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {displayFullName}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-500">
                      {displayEmail}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      {displayRole} · {activeBranch}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/configuracion?tab=usuarios');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                      <span>Mi cuenta y perfil clínico</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/configuracion?tab=empresa');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                      <span>Parámetros de la clínica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/configuracion?tab=usuarios');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                      <span>Roles y seguridad de acceso</span>
                    </button>

                    <Link
                      to="/"
                      onClick={() => setOpenMenu(null)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="flex items-center gap-2.5">
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>Ver Portal Público (Landing)</span>
                      </span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Modal global Command-K (⌘K) */}
      <CommandPaletteModal open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}
