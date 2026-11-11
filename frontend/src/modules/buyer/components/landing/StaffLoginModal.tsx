import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';

interface StaffLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccessLogin: (session: StaffSession, destinationPath: string) => void;
  onSwitchToPatientPortal?: () => void;
}

const DESTINATION_MODULES = [
  { path: '/buyer', label: 'Embudo BUYER (Captación)' },
  { path: '/lead', label: 'Mesa de Negociación (LEAD)' },
  { path: '/customer/agent', label: 'Agente CUSTOMER' },
  { path: '/reportes', label: 'Reportes Matriciales (BI)' },
  { path: '/configuracion', label: 'Configuración de Clínica' },
];

export function StaffLoginModal({
  open,
  onOpenChange,
  onSuccessLogin,
  onSwitchToPatientPortal,
}: StaffLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [destination, setDestination] = useState('/buyer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setError(null); }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await staffAuthService.authenticate(email, password);
      onSuccessLogin(session, destination);
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión. Revisa tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-2xl border border-slate-200/90 bg-white p-0 overflow-hidden text-slate-900 shadow-2xl">
        {/* Cabecera clínica sobria */}
        <div className="relative border-b border-slate-100 bg-gradient-to-b from-[#ECFDF5]/60 via-white to-white px-6 pt-6 pb-5">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46] ring-1 ring-emerald-700/15">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              Acceso al Sistema Clínico & BI
            </span>
            <span className="font-mono text-[10.5px] font-medium text-slate-400">
              NexoSalud ERP v2.6
            </span>
          </div>

          <DialogTitle className="mt-3 text-lg font-semibold tracking-tight text-slate-900">
            Iniciar sesión en NexoSalud
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500">
            Ingresa con tu cuenta institucional para gestionar el embudo de pacientes (BUYER, LEAD, PAYER,
            CUSTOMER, TURNED), reportes analíticos y configuración.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2 text-xs text-teal-900">
            Usa tus credenciales institucionales. El servidor valida tu identidad y los permisos asociados a tu rol.
          </p>

          {/* Correo institucional */}
          <div className="space-y-1.5">
            <label htmlFor="staff-email" className="block text-xs font-semibold text-slate-700">
              Correo institucional
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                aria-hidden
              />
              <input
                id="staff-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="usuario@nexosalud.pe"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs font-medium text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
            </div>
          </div>

          {/* Contraseña y Módulo de Destino en 2 columnas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="staff-password" className="block text-xs font-semibold text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400"
                  aria-hidden
                />
                <input
                  id="staff-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-medium text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="staff-destination" className="block text-xs font-semibold text-slate-700">
                Módulo inicial
              </label>
              <select
                id="staff-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-800 transition-all focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              >
                {DESTINATION_MODULES.map((m) => (
                  <option key={m.path} value={m.path}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Iniciando sesión en el sistema…</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <span>Entrar al Sistema NexoSalud</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>

          {onSwitchToPatientPortal && (
            <div className="border-t border-slate-100 pt-3 text-center">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onSwitchToPatientPortal();
                }}
                className="text-xs font-medium text-slate-500 hover:text-[#0F766E] cursor-pointer"
              >
                ¿Eres paciente de la clínica?{' '}
                <span className="font-semibold text-[#0F766E] underline underline-offset-2">
                  Ingresa con tu DNI o WhatsApp aquí
                </span>
              </button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
