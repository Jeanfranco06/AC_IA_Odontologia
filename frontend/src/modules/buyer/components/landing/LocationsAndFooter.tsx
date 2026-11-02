import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { normalizeBranchKey, resolveClinicLocations } from './landingData';

interface LocationsAndFooterProps {
  catalogSedes?: any[];
  selectedSede?: string;
  onSelectBranchAndBook: (branchName: string) => void;
  onScrollToSection: (sectionId: string) => void;
  onOpenStaffLogin?: () => void;
}

const SECTION_STAGGER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const CARD_REVEAL = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function LocationsAndFooter({
  catalogSedes,
  selectedSede,
  onSelectBranchAndBook,
  onScrollToSection,
  onOpenStaffLogin,
}: LocationsAndFooterProps) {
  const locations = useMemo(
    () => resolveClinicLocations(catalogSedes),
    [catalogSedes]
  );

  const [claimsModalOpen, setClaimsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [claimSent, setClaimSent] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimDni, setClaimDni] = useState('');
  const [claimSede, setClaimSede] = useState(locations[0]?.name || 'Sede California');
  const [claimDetail, setClaimDetail] = useState('');

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimName.trim() || !claimDni.trim() || !claimDetail.trim()) return;
    setClaimSent(true);
  };

  return (
    <>
      {/* Sección de Sedes Físicas */}
      <section
        id="sedes"
        className="scroll-mt-20 border-t border-[#e1e6dc] bg-[#f1f3eb] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"
          >
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#52705b]">
                <span className="h-px w-7 bg-[#7e9c81]" />
                Una clínica cerca de ti
              </span>
              <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#203c32] sm:text-4xl">
                Tres espacios.
                <span className="block font-normal italic text-[#64806a]">
                  El mismo cuidado.
                </span>
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#68736a]">
                Elige la sede que mejor acompaña tu día. Tu historia clínica está disponible en toda nuestra red.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#d6e0d4] bg-[#f8f8f1] px-3.5 py-2 text-xs font-medium text-[#47664e]">
              <span className="h-2 w-2 rounded-full bg-[#568b64]" aria-hidden />
              Atención hoy hasta las 21:00 hrs
            </span>
          </motion.div>

          <motion.div
            variants={SECTION_STAGGER}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {locations.map((loc, index) => {
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.mapsQuery}`;
              const isSelected =
                Boolean(selectedSede) &&
                normalizeBranchKey(selectedSede || '') === normalizeBranchKey(loc.name);

              return (
                <motion.article
                  key={loc.id}
                  variants={CARD_REVEAL}
                  whileHover={{ y: -4 }}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-[1.65rem] border p-5 transition-all duration-300 sm:p-6 ${
                    isSelected
                      ? 'border-[#5c8a68] bg-[#fbfcf7] ring-2 ring-[#6e956f]/15 shadow-[0_20px_50px_-36px_rgba(27,62,47,0.5)]'
                      : 'border-[#dfe4d9] bg-[#fbfcf7] hover:border-[#a9c0a8] hover:shadow-[0_20px_50px_-36px_rgba(27,62,47,0.45)]'
                  }`}
                >
                  <span
                    className="pointer-events-none absolute -right-2 -top-8 font-serif text-[108px] leading-none text-[#edf0e7]"
                    aria-hidden="true"
                  >
                    0{index + 1}
                  </span>
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="relative">
                        <span className="text-[11px] font-medium text-[#7b8179]">
                          {loc.neighborhood}
                        </span>
                        <h3 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight text-[#243d32]">
                          <span>{loc.name}</span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f0e5] px-2 py-0.5 text-[10px] font-semibold text-[#42694e]">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                              Activa
                            </span>
                          )}
                        </h3>
                      </div>
                      <span className="relative max-w-[48%] rounded-full border border-[#e0e8dc] bg-[#f3f5ec] px-2.5 py-1 text-right text-[10px] font-medium leading-snug text-[#596e56]">
                        {loc.specialtiesBadge}
                      </span>
                    </div>

                    <dl className="mt-5 space-y-4 border-t border-[#e6e9df] pt-4 text-xs">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#64866a]" aria-hidden />
                        <div>
                          <dt className="sr-only">Dirección</dt>
                          <dd className="font-medium text-[#34483b]">{loc.address}</dd>
                          <dd className="mt-0.5 text-[11px] leading-relaxed text-[#798077]">{loc.parkingInfo}</dd>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#64866a]" aria-hidden />
                        <div>
                          <dt className="sr-only">Horario de atención</dt>
                          <dd className="font-mono text-[#34483b]">{loc.scheduleWeekdays}</dd>
                          <dd className="mt-0.5 font-mono text-[11px] text-[#798077]">{loc.scheduleSaturday}</dd>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <Phone className="h-4 w-4 shrink-0 text-[#64866a]" aria-hidden />
                        <div>
                          <dt className="sr-only">Teléfono</dt>
                          <dd className="font-mono font-medium text-[#34483b]">
                            Central directa: {loc.phone}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-2.5 pt-2">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#dfe5da] bg-white px-3 text-xs font-medium text-[#45564a] transition-colors hover:border-[#adc2ac] hover:bg-[#f5f7f0] active:scale-[0.98]"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="h-3.5 w-3.5 text-[#718475]" aria-hidden />
                    </a>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectBranchAndBook(loc.name);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#285c46] px-3 text-xs font-semibold text-white shadow-[0_5px_15px_-9px_rgba(40,92,70,0.75)] transition-colors hover:bg-[#1d4b39] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#68896d]/30 cursor-pointer"
                    >
                      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>Agendar aquí</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    </motion.button>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Footer Institucional */}
      <footer className="border-t border-[#294c3b] bg-[#183d32] text-[#d3dfd3]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Columna 1: Identidad Institucional */}
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/Logo_NexoSalud.png"
                  alt="NexoSalud Dental"
                  className="h-9 w-9 rounded-xl border border-white/15 bg-white object-contain p-1"
                />
                <span className="text-base font-semibold tracking-tight text-white">
                  NexoSalud <span className="text-[#a9c5a9]">Dental</span>
                </span>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-[#bdcbbf]">
                Red de clínicas odontológicas especializadas en diagnóstico digital 3D, rehabilitación oral,
                ortodoncia y estética dental bajo estándares internacionales de bioseguridad.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-[#8fa594]">
                <span>RUC: 20609841251</span>
                <span>·</span>
                <span>RENIPRESS: 00028491</span>
              </div>
            </div>

            {/* Columna 2: Navegación Rápida */}
            <div className="md:col-span-3 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Navegación Clínica
              </p>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => onScrollToSection('agendar-cita')}
                    className="text-[#bdcbbf] transition-colors hover:text-white cursor-pointer"
                  >
                    Agendar evaluación
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onScrollToSection('tratamientos')}
                    className="text-[#bdcbbf] transition-colors hover:text-white cursor-pointer"
                  >
                    Especialidades médicas
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onScrollToSection('tecnologia')}
                    className="text-[#bdcbbf] transition-colors hover:text-white cursor-pointer"
                  >
                    Tecnología 3D y Rayos X
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onScrollToSection('sedes')}
                    className="text-[#bdcbbf] transition-colors hover:text-white cursor-pointer"
                  >
                    Sedes y horarios en Trujillo
                  </button>
                </li>
                {onOpenStaffLogin && (
                  <li className="pt-1">
                    <button
                      type="button"
                      onClick={onOpenStaffLogin}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#a9c5a9] hover:text-white hover:underline cursor-pointer"
                    >
                      <Lock className="h-3 w-3" aria-hidden />
                      <span>Acceso Personal Clínico / BI</span>
                    </button>
                  </li>
                )}
              </ul>
            </div>

            {/* Columna 3: Cumplimiento Normativo y Libro de Reclamaciones */}
            <div className="md:col-span-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white">
                Transparencia y Normativa de Salud
              </p>
              <ul className="space-y-2 text-xs text-[#bdcbbf]">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#a9c5a9]" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setPrivacyModalOpen(true)}
                    className="text-left hover:text-white hover:underline cursor-pointer"
                  >
                    Política de Privacidad y Datos Clínicos (Ley N° 29733)
                  </button>
                </li>
                <li className="flex items-center gap-2">
                  <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-[#a9c5a9]" aria-hidden />
                  <span>Supervisado por SUSALUD · Norma Técnica MINSA N° 139</span>
                </li>
                <li className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-[#a9c5a9]" aria-hidden />
                  <span>Colegio Odontológico del Perú — Región La Libertad</span>
                </li>
              </ul>

              {/* Botón Oficial Libro de Reclamaciones */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setClaimSent(false);
                    setClaimsModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-left text-xs font-semibold text-white transition-colors hover:border-[#a9c5a9]/50 hover:bg-white/[0.1] active:scale-[0.98] cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 text-[#a9c5a9]" aria-hidden />
                  <div>
                    <span className="block leading-none">Libro de Reclamaciones</span>
                    <span className="mt-0.5 block text-[10px] font-normal text-[#bdcbbf]">
                      Conforme al Código de Protección al Consumidor · INDECOPI / SUSALUD
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/15 pt-6 text-xs text-[#9eb0a1] sm:flex-row">
            <p>© 2026 NexoSalud Dental S.A.C. Todos los derechos reservados.</p>
            <p>Atención odontológica sujeta a evaluación diagnóstica presencial por profesional colegiado.</p>
          </div>
        </div>
      </footer>

      {/* Modal: Libro de Reclamaciones Virtual */}
      <Dialog open={claimsModalOpen} onOpenChange={setClaimsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-[#0F766E]" />
              <span>Libro de Reclamaciones en Salud</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              NexoSalud Dental S.A.C. · RUC 20609841251 · Registro IPRESS N° 00028491
            </DialogDescription>
          </DialogHeader>

          {claimSent ? (
            <div className="py-4 text-center space-y-3">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ECFDF5] text-[#0F766E]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Hoja de reclamación registrada</p>
              <p className="text-xs text-slate-600">
                Hemos generado tu constancia de atención conforme al reglamento de SUSALUD e INDECOPI.
              </p>
              <button
                type="button"
                onClick={() => setClaimsModalOpen(false)}
                className="h-9 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#115E59]"
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleClaimSubmit} className="space-y-3 pt-2 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Nombres y apellidos *</label>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">DNI / CE *</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={claimDni}
                    onChange={(e) => setClaimDni(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Sede</label>
                  <select
                    value={claimSede}
                    onChange={(e) => setClaimSede(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-[#0F766E] focus:outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Detalle del reclamo o queja *</label>
                <textarea
                  rows={3}
                  required
                  value={claimDetail}
                  onChange={(e) => setClaimDetail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClaimsModalOpen(false)}
                  className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#115E59]"
                >
                  Registrar hoja
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Política de Privacidad y Protección de Datos Personales */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
              <span>Protección de Datos Personales y Secreto Médico</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ley N° 29733 y Ley General de Salud N° 26842
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs leading-relaxed text-slate-600">
            <p>
              Los datos personales y de contacto recopilados a través de este portal son incorporados al banco
              de datos de <strong>Pacientes y Prospectos de NexoSalud Dental</strong>, con la única finalidad de
              coordinar citas odontológicas, recordatorios clínicos y seguimiento postoperatorio.
            </p>
            <p>
              Toda información diagnóstica, radiográfica y odontogramas se encuentra resguardada bajo secreto
              profesional médico y cifrado de extremo a extremo. No compartimos ni comercializamos tus datos con
              terceros.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="h-9 rounded-lg bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#115E59]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
