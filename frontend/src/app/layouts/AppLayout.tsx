import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Building2,
  Check,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import { Header } from '@/shared/components/layout/Header';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Toaster } from '@/shared/components/ui/toaster';
import { CLINIC_BRANCH_OPTIONS, useSidebar } from '@/shared/context/SidebarContext';
import { useTheme } from '@/shared/context/ThemeContext';

export default function AppLayout() {
  const { isCollapsed, toggleSidebar, activeBranch, setActiveBranch } = useSidebar();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  const logoSrc = theme === 'dark' ? '/Logo_NexoSalus_Oscuro.png' : '/Logo_NexoSalud.png';

  const currentBranchShort =
    CLINIC_BRANCH_OPTIONS.find((b) => b.label === activeBranch)?.shortLabel || activeBranch;

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (
        branchDropdownRef.current &&
        !branchDropdownRef.current.contains(e.target as Node)
      ) {
        setBranchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="pt-shell flex h-dvh w-full overflow-hidden">
      {/* Sidebar Desktop Fijo / Colapsable (Estándar Enterprise) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 h-dvh border-r border-[color:var(--pt-line)] bg-[var(--pt-sunken)] transition-[width] duration-200 ease-out z-30 select-none ${
 isCollapsed ? 'w-[68px]' : 'w-64'
 }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand Header (64px de alto, alineado con el Top Header) */}
          <div
            ref={branchDropdownRef}
            className={`relative flex h-16 shrink-0 items-center border-b border-[color:var(--pt-line)] ${
 isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
 }`}
          >
            {!isCollapsed ? (
              <>
                {/* Selector de Clínica / Sede en Dropdown Elegante */}
                <button
                  type="button"
                  onClick={() => setBranchMenuOpen((v) => !v)}
                  aria-expanded={branchMenuOpen}
                  className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-[var(--pt-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pt-accent)] cursor-pointer"
                >
                  <img
                    src={logoSrc}
                    alt="Logo NexoSalud"
                    className="h-7 w-7 shrink-0 rounded-md border border-[color:var(--pt-line)] bg-[var(--pt-surface)] object-contain p-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="pt-display truncate text-[17px] leading-none text-[color:var(--pt-ink)]">
                        NexoSalud
                      </span>
                      <span className="text-[color:var(--pt-muted)]">•</span>
                      <span className="truncate text-xs font-medium text-[color:var(--pt-ink-2)]">
                        {currentBranchShort.replace('Sede ', '')}
                      </span>
                      <ChevronDown
                        className={`h-3 w-3 shrink-0 text-[color:var(--pt-muted)] transition-transform duration-150 ${
 branchMenuOpen ? 'rotate-180 text-[color:var(--pt-ink-2)]' : ''
 }`}
                        strokeWidth={1.75}
                      />
                    </div>
                    <p className="truncate text-[11px] text-[color:var(--pt-muted)] leading-tight">
                      {activeBranch}
                    </p>
                  </div>
                </button>

                {/* Botón Colapsable para Modo Compacto */}
                <button
                  type="button"
                  onClick={toggleSidebar}
                  title="Colapsar barra lateral"
                  aria-label="Colapsar barra lateral"
                  className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--pt-muted)] transition-colors duration-150 hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink-2)] cursor-pointer"
                >
                  <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
                </button>

                {/* Dropdown de Selección de Sede */}
                <AnimatePresence>
                  {branchMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-3 right-3 top-[60px] z-50 rounded-xl border border-[color:var(--pt-line)] bg-[var(--pt-surface)] p-1.5 shadow-lg"
                    >
                      <p className="px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-[color:var(--pt-muted)]">
                        Sedes Clínicas · Trujillo
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
                                setBranchMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
 selected
 ? 'bg-[var(--pt-accent-soft)] font-semibold text-[color:var(--pt-accent)] '
 : 'text-[color:var(--pt-ink-2)] hover:bg-[var(--pt-sunken)] '
 }`}
                            >
                              <span className="flex items-center gap-2 truncate">
                                <Building2
                                  className={`h-3.5 w-3.5 shrink-0 ${
 selected ? 'text-[color:var(--pt-accent)]' : 'text-[color:var(--pt-muted)]'
 }`}
                                  strokeWidth={1.75}
                                />
                                <span className="truncate">{branch.label}</span>
                              </span>
                              {selected && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[color:var(--pt-accent)]" strokeWidth={2} />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-1 border-t border-[color:var(--pt-line)] pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBranchMenuOpen(false);
                            navigate('/configuracion?tab=sedes');
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[color:var(--pt-muted)] hover:bg-[var(--pt-sunken)] hover:text-[color:var(--pt-ink)] cursor-pointer"
                        >
                          <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
                          <span>Administrar sedes</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                title={`Expandir navegación (${activeBranch})`}
                aria-label="Expandir barra lateral"
                className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--pt-line)] bg-[var(--pt-surface)] transition-colors hover:border-[color:var(--pt-accent)] hover:bg-[var(--pt-sunken)] cursor-pointer"
              >
                <img
                  src={logoSrc}
                  alt="Logo NexoSalud"
                  className="h-6 w-6 object-contain transition-opacity group-hover:opacity-0"
                />
                <PanelLeftOpen
                  className="absolute h-4 w-4 text-[color:var(--pt-accent)] opacity-0 transition-opacity group-hover:opacity-100"
                  strokeWidth={1.75}
                />
              </button>
            )}
          </div>

          {/* Lista de Categorías del Sidebar con scroll limpio */}
          <div
            className={`flex-1 overflow-y-auto no-scrollbar ${
 isCollapsed ? 'px-2 py-3' : 'px-3 py-4'
 }`}
          >
            <Sidebar />
          </div>
        </div>
      </aside>

      {/* Área Principal de Trabajo */}
      <div className="flex flex-1 flex-col min-w-0 h-dvh overflow-y-auto">
        <Header />
        <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
          <div className="w-full max-w-none">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
