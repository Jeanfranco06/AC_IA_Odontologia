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
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[color:var(--pt-line)] bg-[color-mix(in_srgb,var(--pt-bg)_86%,transparent)] px-4 sm:px-6 lg:px-8 backdrop-blur-md transition-colors">
        {/* 1. ZONA IZQUIERDA: Botón Mobile Drawer + Breadcrumb Funcional */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Drawer Trigger */}
          <div className="md:hidden">
            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir navegación"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)]"
                >
                  <Menu className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="pt-shell flex w-72 flex-col border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-4"
              >
                <SheetTitle className="flex items-center justify-between border-b border-[color:var(--pt-line)] pb-4 text-sm font-semibold text-[color:var(--pt-ink)]">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={logoSrc}
                      alt="NexoSalud"
                      className="h-7 w-7 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] object-contain p-0.5"
                    />
                    <div className="flex flex-col text-left">
                      <span className="leading-none">NexoSalud</span>
                      <span className="mt-1 text-[11px] font-normal text-[color:var(--pt-muted)] leading-none">
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
                      className="h-3.5 w-3.5 shrink-0 text-[color:var(--pt-muted)]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  {isLast || !segment.to ? (
                    <span
                      className={`truncate ${
 isLast
 ? 'font-semibold text-[color:var(--pt-ink)] '
 : 'hidden sm:inline font-medium text-[color:var(--pt-muted)] '
 }`}
                    >
                      {segment.label}
                    </span>
                  ) : (
                    <Link
                      to={segment.to}
                      className="hidden sm:inline truncate font-medium text-[color:var(--pt-muted)] transition-colors hover:text-[color:var(--pt-ink)]"
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
            className="group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] px-3 text-left text-[13px] text-[color:var(--pt-muted)] transition-all duration-150 hover:border-[color:var(--pt-line-strong)] hover:bg-[var(--pt-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pt-accent)] cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-[color:var(--pt-muted)] group-hover:text-[color:var(--pt-accent)] transition-colors"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="truncate">Buscar paciente, cita o reporte...</span>
            </span>
            <kbd className="inline-flex shrink-0 items-center gap-0.5 rounded border border-[color:var(--pt-line)] bg-[var(--pt-surface)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[color:var(--pt-muted)] shadow-2xs">
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
            className="inline-flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] cursor-pointer"
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
              className="hidden sm:inline-flex h-8 items-center gap-2 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] px-2.5 text-xs font-medium text-[color:var(--pt-ink-2)] transition-colors duration-150 hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] cursor-pointer"
            >
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="h-2 w-2 rounded-full bg-[var(--pt-ok)]" />
              </span>
              <span>Sincronizado</span>
              <ChevronDown
                className={`h-3 w-3 text-[color:var(--pt-muted)] transition-transform duration-150 ${
 openMenu === 'datamart' ? 'rotate-180 text-[color:var(--pt-ink-2)]' : ''
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
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3.5 shadow-lg z-50"
                >
                  <div className="flex items-center justify-between border-b border-[color:var(--pt-line)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[color:var(--pt-accent)]" strokeWidth={1.75} />
                      <span className="text-xs font-semibold text-[color:var(--pt-ink)]">
                        Estado de Sincronización
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pt-ok-soft)] px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wider text-[color:var(--pt-ok)]">
                      Activo
                    </span>
                  </div>

                  <dl className="mt-2.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <dt className="text-[color:var(--pt-muted)]">Última actualización</dt>
                      <dd className="font-mono font-medium text-[color:var(--pt-ink)]">
                        {lastSyncMinutes === 0 ? 'Justo ahora' : `Hace ${lastSyncMinutes} min`}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-[color:var(--pt-muted)]">Latencia de consulta</dt>
                      <dd className="font-mono font-medium text-[color:var(--pt-ok)]">
                        18 ms
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-[color:var(--pt-muted)]">Cobertura de etapas</dt>
                      <dd className="font-mono font-medium text-[color:var(--pt-ink)]">
                        5 / 5 módulos
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 border-t border-[color:var(--pt-line)] pt-2.5">
                    <button
                      type="button"
                      disabled={syncingNow}
                      onClick={handleManualSync}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] text-xs font-medium text-[color:var(--pt-ink-2)] transition-colors hover:bg-[var(--pt-sunken)] cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 text-[color:var(--pt-accent)] ${syncingNow ? 'animate-spin' : ''}`}
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] transition-colors duration-150 hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] cursor-pointer"
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
                  className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 shadow-lg z-50"
                >
                  <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--pt-muted)]">
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
 ? 'bg-[var(--pt-accent-soft)] font-semibold text-[color:var(--pt-accent)] '
 : 'text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] '
 }`}
                        >
                          <span className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
                            <span>{branch.label}</span>
                          </span>
                          {selected && <Check className="h-3.5 w-3.5 text-[color:var(--pt-accent)]" strokeWidth={2} />}
                        </button>
                      );
                    })}
                  </div>

                  <div className="my-2.5 border-t border-[color:var(--pt-line)]" />

                  <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-[color:var(--pt-muted)]">
                    Recaudación y Terminales
                  </p>
                  <div className="rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-sunken)] p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-[color:var(--pt-ink-2)]">
                        <CreditCard className="h-3.5 w-3.5 text-[color:var(--pt-accent)]" strokeWidth={1.75} />
                        <span>Pasarela Tarjetas & Yape</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={paymentGatewayEnabled}
                        onClick={() => setPaymentGatewayEnabled((v) => !v)}
                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
 paymentGatewayEnabled ? 'bg-[var(--pt-accent)]' : 'bg-[var(--pt-line)] '
 }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-[var(--pt-surface)] transition-transform ${
 paymentGatewayEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
 }`}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-[color:var(--pt-muted)]">
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
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] text-[color:var(--pt-ink-2)] transition-colors duration-150 hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] cursor-pointer"
            >
              <Bell className="h-[15px] w-[15px]" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--pt-accent)] px-1 font-mono text-[10px] font-semibold text-[color:var(--pt-accent-ink)] ring-2 ring-[color:var(--pt-line)]">
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
                  className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-3 shadow-lg z-50"
                >
                  <div className="flex items-center justify-between border-b border-[color:var(--pt-line)] pb-2">
                    <span className="text-xs font-semibold text-[color:var(--pt-ink)]">
                      Actividad Reciente
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-medium text-[color:var(--pt-accent)] hover:underline cursor-pointer"
                      >
                        Marcar leídas
                      </button>
                    )}
                  </div>

                  <div className="mt-2 divide-y divide-[color:var(--pt-line)]">
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
                        className="flex w-full items-start gap-2.5 py-2.5 text-left transition-colors hover:bg-[var(--pt-sunken)] rounded-lg px-2 cursor-pointer"
                      >
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
 item.unread ? 'bg-[var(--pt-accent)]' : 'bg-[var(--pt-line)] '
 }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-[color:var(--pt-ink)]">
                              {item.title}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-[color:var(--pt-muted)]">
                              {item.time}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[color:var(--pt-muted)] leading-snug">
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
          <div className="mx-0.5 h-5 w-px bg-[var(--pt-line)]" aria-hidden />

          {/* 3.5 Perfil de Usuario Enterprise con Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleMenu('profile')}
              aria-expanded={openMenu === 'profile'}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition-colors duration-150 hover:bg-[var(--pt-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pt-accent)] cursor-pointer"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pt-ink)] text-xs font-semibold text-[color:var(--pt-accent-ink)] ring-1 ring-[color:var(--pt-line)]">
                {displayInitials}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-semibold text-[color:var(--pt-ink)] leading-tight max-w-[125px] truncate">
                  {displayFullName}
                </span>
                <span className="text-[11px] text-[color:var(--pt-muted)] leading-tight max-w-[125px] truncate">
                  {displayRole}
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-[color:var(--pt-muted)] transition-transform duration-150 ${
 openMenu === 'profile' ? 'rotate-180 text-[color:var(--pt-ink-2)]' : ''
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
                  className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 shadow-lg z-50"
                >
                  <div className="border-b border-[color:var(--pt-line)] px-3 py-2.5">
                    <p className="truncate text-xs font-semibold text-[color:var(--pt-ink)]">
                      {displayFullName}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[color:var(--pt-muted)]">
                      {displayEmail}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--pt-sunken)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--pt-ink-2)]">
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
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
                      <span>Mi cuenta y perfil clínico</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/configuracion?tab=empresa');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
                      <span>Parámetros de la clínica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        navigate('/configuracion?tab=usuarios');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] cursor-pointer"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
                      <span>Roles y seguridad de acceso</span>
                    </button>

                    <Link
                      to="/"
                      onClick={() => setOpenMenu(null)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)]"
                    >
                      <span className="flex items-center gap-2.5">
                        <ExternalLink className="h-3.5 w-3.5 text-[color:var(--pt-muted)]" strokeWidth={1.75} />
                        <span>Ver Portal Público (Landing)</span>
                      </span>
                    </Link>
                  </div>

                  <div className="border-t border-[color:var(--pt-line)] pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[color:var(--pt-danger)] hover:bg-[var(--pt-danger-soft)] cursor-pointer"
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
