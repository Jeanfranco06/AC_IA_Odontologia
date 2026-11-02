import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  ShieldCheck,
  Stethoscope,
  MapPin,
  Clock,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Smile,
  HeartPulse,
  Award,
  ChevronDown,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Toaster } from '@/shared/components/ui/toaster';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { buyerService } from '../services/buyer.service';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { BuyerIntakeForm } from '../components/landing/BuyerIntakeForm';
import { StaffLoginModal } from '../components/landing/StaffLoginModal';
import { LocationsAndFooter } from '../components/landing/LocationsAndFooter';
import type { SedeCatalogItem, ServicioCatalogItem } from '../types/buyer.types';

const POPULAR_TREATMENTS = [
  {
    id: 'ortodoncia',
    title: 'Ortodoncia Invisible & Brackets',
    subtitle: 'Alinea tu sonrisa cómodamente',
    tag: 'Más solicitado',
    detail: 'Alineación a tu ritmo',
    icon: Smile,
    tone: 'sage',
    serviceKeyword: 'ortodoncia',
  },
  {
    id: 'estetica',
    title: 'Diseño de Sonrisa & Carillas',
    subtitle: 'Estética natural de alta precisión',
    tag: 'Estética',
    detail: 'Un resultado que se siente tuyo',
    icon: Sparkles,
    tone: 'sand',
    serviceKeyword: 'diseño',
  },
  {
    id: 'implantes',
    title: 'Implantes Dentales Guiados',
    subtitle: 'Recupera piezas fijas sin dolor',
    tag: 'Especialidad',
    detail: 'Planificación digital 3D',
    icon: ShieldCheck,
    tone: 'stone',
    serviceKeyword: 'implante',
  },
  {
    id: 'general',
    title: 'Alivio del Dolor & Limpieza',
    subtitle: 'Atención oportuna y profilaxis',
    tag: 'Cuidado Integral',
    detail: 'Prevención y atención cercana',
    icon: HeartPulse,
    tone: 'clay',
    serviceKeyword: 'evaluación',
  },
];

const TREATMENT_TONES = {
  sage: {
    icon: 'bg-[#dcece1] text-[#23644e]',
    label: 'bg-[#eaf3eb] text-[#28634d]',
    wash: 'from-[#f6faf5] via-white to-[#edf5ee]',
    mark: 'text-[#cbded0]',
  },
  sand: {
    icon: 'bg-[#f3e8d5] text-[#82613a]',
    label: 'bg-[#f8f0e2] text-[#80613c]',
    wash: 'from-[#fbf8f0] via-white to-[#f7efe0]',
    mark: 'text-[#eadcc5]',
  },
  stone: {
    icon: 'bg-[#e5e9e3] text-[#53684f]',
    label: 'bg-[#edf0e9] text-[#576a50]',
    wash: 'from-[#f8f9f5] via-white to-[#eef1e8]',
    mark: 'text-[#d9e0d4]',
  },
  clay: {
    icon: 'bg-[#f1e2d9] text-[#875943]',
    label: 'bg-[#f7ede6] text-[#895f49]',
    wash: 'from-[#faf6f2] via-white to-[#f6ebe3]',
    mark: 'text-[#ead8cc]',
  },
} as const;

export default function BuyerRequestInfoPage() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [catalogs, setCatalogs] = useState<{
    servicios: ServicioCatalogItem[];
    sedes: SedeCatalogItem[];
    canales: any[];
    fuentes: any[];
  }>({
    servicios: [],
    sedes: [],
    canales: [],
    fuentes: [],
  });

  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [isBookingVisible, setIsBookingVisible] = useState(false);

  useEffect(() => {
    setStaffSession(staffAuthService.getSession());

    buyerService
      .getCatalogs()
      .then((data) => {
        setCatalogs({
          servicios: data.servicios || [],
          sedes: data.sedes || [],
          canales: data.canales || [],
          fuentes: data.fuentes || [],
        });
      })
      .catch((err) => {
        console.warn('Catálogos base:', err);
      });
  }, []);

  useEffect(() => {
    const bookingSection = document.getElementById('formulario-captacion');
    if (!bookingSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsBookingVisible(entry.isIntersecting),
      { rootMargin: '-10% 0px -15% 0px' },
    );

    observer.observe(bookingSection);
    return () => observer.disconnect();
  }, []);

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFocusBooking = () => {
    const el = document.getElementById('formulario-captacion');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = el.querySelector('input') as HTMLInputElement | null;
      if (firstInput) firstInput.focus();
    }
  };

  const handlePickTreatment = (keyword: string) => {
    const matched = catalogs.servicios.find((s) =>
      s.nombre.toLowerCase().includes(keyword.toLowerCase())
    );
    if (matched) {
      setSelectedServiceId(matched.id_servicio);
    }
    handleFocusBooking();
  };

  return (
    <div id="inicio" className="min-h-screen bg-[#FAFCFE] text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Barra de Navegación Pública */}
      <LandingNavbar
        onScrollToSection={handleScrollToSection}
        onFocusBooking={handleFocusBooking}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
        onEnterSystem={() => navigate('/buyer')}
        staffSession={staffSession}
      />

      {/* ── HERO SECTION PRINCIPAL: CLARO, ELEGANTE Y LLAMATIVO CON IMAGEN CLÍNICA REAL ── */}
      <section className="relative overflow-hidden border-b border-[#dfe8df] bg-[radial-gradient(ellipse_at_14%_22%,rgba(210,228,211,0.55),transparent_38%),radial-gradient(ellipse_at_88%_72%,rgba(225,232,210,0.55),transparent_34%),linear-gradient(135deg,#fafaf5_0%,#f2f6ef_55%,#e9f1e9_100%)] pb-14 pt-0 sm:pb-18 lg:pb-24">
        {/* Imagen de fondo referente a las instalaciones clínicas de NexoSalud con overlay de alta legibilidad */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <img
            src="/Fondo_NexoSalud.png"
            alt="Instalaciones NexoSalud Dental"
            className="h-full w-full object-cover object-right-top opacity-[0.13] saturate-[0.8] mix-blend-multiply lg:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fafaf5]/95 via-[#f6f7f1]/85 to-[#edf3e9]/65" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#fafaf5]/25 via-transparent to-[#f1f5ed]/90" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-12 lg:gap-10">
            
            {/* Columna Izquierda: Mensaje Claro y Sin Sobrecarga */}
            <div className="space-y-5 sm:space-y-6 lg:col-span-7">
              
              {/* Badge llamativo */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d6e4d7] bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#43694e] shadow-[0_4px_14px_-12px_rgba(27,62,47,0.5)] backdrop-blur-sm">
                <span className="flex h-2 w-2 rounded-full bg-[#548c65] shadow-[0_0_0_3px_rgba(84,140,101,0.12)]" />
                <span>Odontología Especializada en Trujillo</span>
              </div>

              {/* Título de alto impacto */}
              <h1 className="max-w-[13ch] text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.055em] text-[#203c32] sm:text-5xl lg:text-[3.55rem]">
                Tu sonrisa en manos expertas.
                <span className="mt-1 block font-normal italic tracking-[-0.045em] text-[#5b8062]">
                  Cuidado moderno, claro y sin dolor.
                </span>
              </h1>

              {/* Párrafo sintético y tranquilizador */}
              <p className="max-w-xl text-[15px] leading-[1.75] text-[#657168] sm:text-base">
                Te orientamos con honestidad sobre tratamientos, opciones de cuotas y disponibilidad en Trujillo. Sin términos complicados ni ventas de presión.
              </p>

              {/* 3 Beneficios Clave en Píldoras Visuales */}
              <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3 sm:gap-2">
                <div className="group flex items-center gap-2.5 rounded-2xl border border-[#e1e8de] bg-white/75 p-3 shadow-[0_8px_24px_-22px_rgba(27,62,47,0.55)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c2d5c1] hover:bg-white">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf2e9] text-[#4c7656] transition-colors group-hover:bg-[#deebde]">
                    <Stethoscope className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#2d4536]">Especialistas RNE</h4>
                    <p className="text-[11px] text-[#7a8378]">Colegiados COP</p>
                  </div>
                </div>

                <div className="group flex items-center gap-2.5 rounded-2xl border border-[#e1e8de] bg-white/75 p-3 shadow-[0_8px_24px_-22px_rgba(27,62,47,0.55)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c2d5c1] hover:bg-white">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf2e9] text-[#4c7656] transition-colors group-hover:bg-[#deebde]">
                    <Clock className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#2d4536]">Respuesta Rápida</h4>
                    <p className="text-[11px] text-[#7a8378]">&lt; 15 min por WhatsApp</p>
                  </div>
                </div>

                <div className="group flex items-center gap-2.5 rounded-2xl border border-[#e1e8de] bg-white/75 p-3 shadow-[0_8px_24px_-22px_rgba(27,62,47,0.55)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c2d5c1] hover:bg-white">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf2e9] text-[#4c7656] transition-colors group-hover:bg-[#deebde]">
                    <MapPin className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[#2d4536]">3 Sedes Trujillo</h4>
                    <p className="text-[11px] text-[#7a8378]">California · El Golf · Centro</p>
                  </div>
                </div>
              </div>

              {/* Botón rápido para WhatsApp directo */}
              <div className="flex items-center gap-3 pt-1 sm:pt-2">
                <a
                  href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20quisiera%20recibir%20orientaci%C3%B3n%20sobre%20tratamientos."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#238c4f] bg-[#218a4b] px-5 py-3 text-xs font-semibold text-white shadow-[0_10px_24px_-14px_rgba(28,110,62,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#197641] hover:shadow-[0_14px_28px_-14px_rgba(28,110,62,0.75)] active:translate-y-0 sm:text-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Escribir por WhatsApp directamente</span>
                </a>
                <span className="hidden text-xs font-medium text-[#788378] sm:inline">o completa el formulario</span>
              </div>
            </div>

            {/* Columna Derecha: Formulario Intuitivo y Atractivo */}
            <div id="formulario-captacion" className="scroll-mt-24 lg:col-span-5 lg:translate-y-1">
              <BuyerIntakeForm
                sedes={catalogs.sedes}
                servicios={catalogs.servicios}
                preselectedServiceId={selectedServiceId}
              />
            </div>

          </div>
        </div>
      </section>

      <section
        id="tratamientos"
        className="scroll-mt-20 border-b border-[#e6e9df] bg-[#f7f7f1] py-16 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mb-9 grid gap-5 sm:mb-12 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#52705b]">
                <span className="h-px w-7 bg-[#7e9c81]" />
                Atención a tu manera
              </span>
              <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#203c32] sm:text-4xl lg:text-5xl">
                Una sonrisa.{' '}
                <span className="font-normal italic text-[#64806a]">Muchas formas de cuidarla.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[#68736a] sm:pb-1">
              Explora por dónde empezar. Si todavía tienes dudas, te ayudamos a encontrar el camino.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: shouldReduceMotion ? 0 : 0.1 },
              },
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:gap-4"
          >
            {POPULAR_TREATMENTS.map((treatment, index) => {
              const Icon = treatment.icon;
              const tone = TREATMENT_TONES[treatment.tone as keyof typeof TREATMENT_TONES];
              const gridSpan =
                index === 0 || index === 3
                  ? 'lg:col-span-7'
                  : 'lg:col-span-5';

              return (
                <motion.button
                  key={treatment.id}
                  type="button"
                  variants={{
                    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.99 }}
                  onClick={() => handlePickTreatment(treatment.serviceKeyword)}
                  className={`group relative isolate flex min-h-[220px] w-full flex-col overflow-hidden rounded-[1.65rem] border border-[#e5e8de] bg-gradient-to-br ${tone.wash} p-5 text-left shadow-[0_8px_24px_-22px_rgba(27,62,47,0.55)] transition-[border-color,box-shadow] duration-300 hover:border-[#afc6b1] hover:shadow-[0_22px_50px_-30px_rgba(31,83,60,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#527f63] focus-visible:ring-offset-2 sm:min-h-[235px] sm:p-7 ${gridSpan}`}
                >
                  <span
                    className={`pointer-events-none absolute -right-7 -top-9 select-none font-serif text-[190px] leading-none opacity-60 transition-transform duration-500 ease-out group-hover:rotate-6 group-hover:scale-110 ${tone.mark}`}
                    aria-hidden="true"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`relative flex h-12 w-12 items-center justify-center rounded-[17px] ${tone.icon} transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <div className="relative mt-5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${tone.label}`}>
                      {treatment.tag}
                    </span>
                    <span className="text-[11px] text-[#7b8179]">
                      {treatment.detail}
                    </span>
                  </div>
                  <h3 className="relative mt-2 max-w-[28rem] text-lg font-semibold leading-snug tracking-[-0.025em] text-[#243d32] transition-colors group-hover:text-[#176b5b] sm:text-xl">
                    {treatment.title}
                  </h3>
                  <div className="relative mt-auto flex items-center justify-between gap-3 pt-4">
                    <p className="text-xs leading-relaxed text-[#6c756c]">{treatment.subtitle}</p>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dce4d9] bg-white/80 text-[#42664d] transition-all duration-300 group-hover:translate-x-1 group-hover:border-[#527f63] group-hover:bg-[#28634d] group-hover:text-white">
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section
        id="tu-experiencia"
        className="relative isolate overflow-hidden border-b border-[#355548] bg-[#183d32] py-16 text-[#f4f4e9] sm:py-24"
      >
        <div
          className="pointer-events-none absolute -right-28 top-0 -z-10 h-96 w-96 rounded-full border border-white/[0.07] sm:right-8 sm:top-1/2 sm:-translate-y-1/2"
          aria-hidden="true"
        >
          <div className="absolute inset-8 rounded-full border border-white/[0.06]" />
          <div className="absolute inset-16 rounded-full border border-white/[0.05]" />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 flex flex-col gap-5 sm:mb-14 sm:flex-row sm:items-end sm:justify-between"
          >
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a9c5a9]">
                <span className="h-px w-7 bg-[#a9c5a9]" />
                Sin presión, a tu ritmo
              </span>
              <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-4xl">
                Primero escuchamos.
                <span className="block font-normal italic text-[#b8cdb5]">Luego, tú decides.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-[#c2d0c4]">
              Atención clara desde el primer mensaje hasta que encuentres el momento adecuado para visitarnos.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: shouldReduceMotion ? 0 : 0.12 },
              },
            }}
            className="relative grid grid-cols-1 gap-0 border-t border-white/15 sm:grid-cols-3"
          >
            <div
              className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-8 hidden h-px bg-gradient-to-r from-[#9ab99c]/20 via-[#9ab99c]/70 to-[#9ab99c]/20 sm:block"
              aria-hidden="true"
            />
            {[
              {
                number: '01',
                title: 'Cuéntanos tu inquietud',
                detail: 'Un mensaje basta para empezar. Sin cuestionarios médicos ni compromiso.',
                marker: 'Te escuchamos',
              },
              {
                number: '02',
                title: 'Recibe orientación',
                detail: 'Un asesor aclara opciones, rangos de precio y especialistas contigo.',
                marker: 'Cerca de ti',
              },
              {
                number: '03',
                title: 'Tú eliges el siguiente paso',
                detail: 'Si lo deseas, coordinamos una evaluación en la sede y horario que prefieras.',
                marker: 'A tu manera',
              },
            ].map((step) => (
              <motion.article
                key={step.number}
                variants={{
                  hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                className="group relative border-b border-white/15 px-1 py-6 last:border-b-0 sm:border-b-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0"
              >
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-[#71917a]/55 bg-[#214a3b] font-mono text-sm text-[#d9e4d7] shadow-[0_0_0_8px_#183d32] transition-colors duration-300 group-hover:border-[#b8cdb5] group-hover:bg-[#2b5946]">
                  {step.number}
                </div>
                <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a9c5a9]">
                  {step.marker}
                </p>
                <h3 className="mt-2 text-lg font-medium tracking-tight text-white sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#c2d0c4]">
                  {step.detail}
                </p>
              </motion.article>
            ))}
          </motion.div>

          <motion.button
            type="button"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onClick={handleFocusBooking}
            className="mt-9 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#e6eee0] px-5 py-2.5 text-sm font-semibold text-[#214b3b] transition-all hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#183d32]"
          >
            Comenzar con una consulta
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </section>

      <section className="border-b border-[#e7e9e1] bg-[#fbfaf6] py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:px-8">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:sticky lg:top-28 lg:self-start"
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#52705b]">
              <span className="h-px w-7 bg-[#7e9c81]" />
              Antes de escribirnos
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-[#203c32] sm:text-4xl">
              Lo que necesitas saber.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#68736a]">
              Queremos que decidas con tranquilidad. Aquí respondemos lo más importante.
            </p>
            <button
              type="button"
              onClick={handleFocusBooking}
              className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#d4dfd4] bg-white px-4 text-xs font-semibold text-[#315b44] transition-colors hover:border-[#9db79f] hover:bg-[#f1f6ef] active:scale-[0.98]"
            >
              Hablar con un asesor
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          <div className="divide-y divide-[#e3e7df] border-y border-[#e3e7df]">
            {[
              {
                question: '¿Tiene algún costo enviar mi consulta?',
                answer:
                  'No. Esta solicitud es gratuita y sin compromiso. Te explicaremos opciones, costos y modalidades antes de que decidas acudir a una cita.',
              },
              {
                question: '¿Ofrecen planes en cuotas para tratamientos?',
                answer:
                  'Sí. Para tratamientos como ortodoncia o implantes dentales, contamos con financiamiento directo en cuotas mensuales sin intereses, además de pagos con tarjeta de crédito.',
              },
              {
                question: '¿Qué hacen con mis datos personales?',
                answer:
                  'Bajo la Ley N.° 29733, tus datos están protegidos y solo se usan para responder tu consulta. Nunca enviamos spam ni compartimos tu número con terceros.',
              },
            ].map((item, index) => (
              <motion.details
                key={item.question}
                initial={shouldReduceMotion ? false : { opacity: 0, x: 14 }}
                whileInView={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{
                  duration: 0.4,
                  delay: shouldReduceMotion ? 0 : index * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                open={index === 0 ? true : undefined}
                className="group py-1"
              >
                <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#527f63] [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start gap-4">
                    <span className="pt-0.5 font-mono text-[11px] text-[#789078]">
                      0{index + 1}
                    </span>
                    <span className="text-sm font-medium leading-relaxed text-[#2c4336] sm:text-base">
                      {item.question}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#65826c] transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="max-w-2xl pb-5 pl-10 pr-8 text-sm leading-relaxed text-[#68736a]">
                  {item.answer}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ── SEDES VERIFICADAS EN TRUJILLO Y FOOTER ── */}
      <LocationsAndFooter
        catalogSedes={catalogs.sedes}
        onSelectBranchAndBook={() => handleFocusBooking()}
        onScrollToSection={handleScrollToSection}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
      />

      {/* Botón Flotante de WhatsApp para Contacto Inmediato */}
      {!isBookingVisible && (
        <a
          href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20quisiera%20hacer%20una%20consulta%20directa."
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-xs font-bold text-white shadow-xl shadow-[#25D366]/30 transition-all hover:scale-105 hover:bg-[#20BD5A] active:scale-[0.98]"
          title="Consultar por WhatsApp ahora"
        >
          <MessageSquare className="h-4 w-4 fill-white" />
          <span className="hidden sm:inline">¿Dudas? Escríbenos por WhatsApp</span>
        </a>
      )}

      {/* Modal de Acceso para Personal de la Clínica */}
      <StaffLoginModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        onSuccessLogin={(_session, dest) => {
          setStaffSession(staffAuthService.getSession());
          setStaffModalOpen(false);
          navigate(dest || '/buyer');
        }}
      />

      <Toaster />
    </div>
  );
}
