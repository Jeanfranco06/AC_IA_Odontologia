import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Calendar, Lock, Menu, PhoneCall, ShieldCheck, X, MessageSquare, Stethoscope } from 'lucide-react';
import type { StaffSession } from '@/shared/services/staffAuthService';

interface LandingNavbarProps {
  onScrollToSection: (sectionId: string) => void;
  onFocusBooking: () => void;
  onOpenStaffLogin: () => void;
  onEnterSystem: () => void;
  staffSession: StaffSession | null;
}

const NAV_LINKS = [
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'tu-experiencia', label: 'Cómo Atendemos' },
  { id: 'sedes', label: 'Sedes en Trujillo' },
  { id: 'inicio', label: 'Orientación Online' },
];

export function LandingNavbar({
  onScrollToSection,
  onFocusBooking,
  onOpenStaffLogin,
  onEnterSystem,
  staffSession,
}: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id: string) => {
    setMobileOpen(false);
    onScrollToSection(id);
  };

  const handleBook = () => {
    setMobileOpen(false);
    onFocusBooking();
  };

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 w-full border-b border-[#dfe8e2] bg-[#fffefa]/95 shadow-[0_8px_24px_-22px_rgba(25,70,55,0.65)] backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center">
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              handleNav('inicio');
            }}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361] focus-visible:ring-offset-4 sm:gap-3"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[#dce9df] bg-white p-1 shadow-[0_3px_10px_-7px_rgba(20,88,67,0.5)] transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105 sm:h-11 sm:w-11">
              <img
                src="/Logo_NexoSalud.png"
                alt="NexoSalud Odontología"
                className="h-full w-full object-contain"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#fffefa] bg-[#428a68]" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="whitespace-nowrap text-[15px] font-bold leading-none tracking-[-0.04em] text-[#183c36] sm:text-base">
                NexoSalud <span className="font-semibold text-[#287361]">Dental</span>
              </span>
              <span className="mt-1.5 hidden text-[10px] font-medium uppercase leading-none tracking-[0.12em] text-slate-500 sm:block">
                Especialidades · Trujillo
              </span>
            </div>
          </a>
        </div>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-1 rounded-full border border-[#e7ece7] bg-white/70 p-1 xl:flex"
        >
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="cursor-pointer rounded-full px-3.5 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-[#edf5ef] hover:text-[#175b4f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361]"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 xl:flex">
          <a
            href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20requiero%20orientaci%C3%B3n%20odontol%C3%B3gica"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e3ebe5] bg-white px-3 text-xs font-semibold text-slate-700 transition-all hover:border-[#b8d2c2] hover:bg-[#f3f8f3] active:scale-[0.98]"
            title="Atención directa de consultas por WhatsApp"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#70ad86] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#438e69]" />
            </span>
            <PhoneCall className="h-3.5 w-3.5 text-[#287361]" />
            <span className="font-mono font-semibold tracking-tight text-[#233c33]">944 612 840</span>
          </a>

          <button
            type="button"
            onClick={handleBook}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#176b5b] px-4 text-xs font-semibold text-white shadow-[0_5px_15px_-8px_rgba(23,107,91,0.7)] transition-all hover:bg-[#12594c] active:scale-[0.98]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Orientación gratis</span>
          </button>

          {staffSession ? (
            <button
              type="button"
              onClick={onEnterSystem}
              title={`Conectado como ${staffSession.nombres} (${staffSession.rol})`}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e3ebe5] bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#f3f8f3]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f1e9] text-[10px] font-bold text-[#175b4f]">
                {staffSession.initials}
              </span>
              <span>Ir al sistema</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#287361]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenStaffLogin}
              title="Acceso exclusivo para el personal de la clínica"
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-[#f3f6f3] hover:text-[#29443a]"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Personal</span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 xl:hidden">
          <button
            type="button"
            onClick={handleBook}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#176b5b] px-3.5 text-xs font-semibold text-white shadow-[0_4px_12px_-7px_rgba(23,107,91,0.8)] transition-colors hover:bg-[#12594c] active:scale-[0.98] sm:h-10 sm:px-4"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden min-[380px]:inline">Consultar</span>
            <span className="min-[380px]:hidden">Cita</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe8e2] bg-white text-[#29443a] transition-colors hover:bg-[#f1f6f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361] sm:h-10 sm:w-10"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Menú Móvil Desplegable */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-[#e6ece7] bg-[#fffefa] px-4 py-4 xl:hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-[#edf5ef] hover:text-[#175b4f]"
                >
                  {link.label}
                </button>
              ))}

              <div className="mt-2 flex flex-col gap-2 border-t border-[#e6ece7] pt-3">
                <a
                  href="https://wa.me/51944612840?text=Hola%20NexoSalud%20Dental,%20requiero%20orientaci%C3%B3n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d3e6d8] bg-[#edf6ef] p-3 text-sm font-semibold text-[#175b4f] transition-colors hover:bg-[#e3f0e5]"
                >
                  <PhoneCall className="h-4 w-4 text-[#287361]" />
                  <span>Escríbenos por WhatsApp · 944 612 840</span>
                </a>

                {staffSession ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onEnterSystem();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b5b] p-3 text-sm font-semibold text-white"
                  >
                    <span>Ir al Sistema ({staffSession.nombres})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onOpenStaffLogin();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8e2] p-3 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f3f6f3]"
                  >
                    <Lock className="h-4 w-4 text-slate-500" />
                    <span>Acceso para Personal</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
