import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  Building2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Lock,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../../services/buyer.service';
import type { SedeCatalogItem, ServicioCatalogItem } from '../../types/buyer.types';

const ORIENTATION_REASONS = [
  { id: 'tratamientos', label: 'Conocer tratamientos', icon: Sparkles, desc: 'Alineadores, implantes o estética' },
  { id: 'precios', label: 'Precios y cuotas', icon: HelpCircle, desc: 'Facilidades de pago y cotizaciones' },
  { id: 'horarios', label: 'Horarios y citas', icon: Clock, desc: 'Disponibilidad en sedes' },
  { id: 'molestia', label: 'Consulta o molestia', icon: ShieldCheck, desc: 'Dolor o revisión general' },
  { id: 'orientacion', label: 'Aún no lo sé', icon: MessageSquare, desc: 'Ayúdenme a elegir', },
];

interface BuyerIntakeFormProps {
  sedes?: SedeCatalogItem[];
  servicios?: ServicioCatalogItem[];
  onSuccess?: (refCode: string) => void;
  preselectedServiceId?: number | null;
}

export const BuyerIntakeForm: React.FC<BuyerIntakeFormProps> = ({
  sedes = [],
  servicios = [],
  onSuccess,
  preselectedServiceId,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('orientacion');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [idSede, setIdSede] = useState<number | ''>('');
  const [idServicio, setIdServicio] = useState<number | ''>(preselectedServiceId || '');
  const [consultaBreve, setConsultaBreve] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (preselectedServiceId) {
      setIdServicio(preselectedServiceId);
      setShowOptionalFields(true);
      setFormStep(2);
    }
  }, [preselectedServiceId]);

  // Validación de teléfono (9 dígitos Perú)
  const handlePhoneChange = async (val: string) => {
    const rawDigits = val.replace(/\D/g, '').slice(0, 9);
    setTelefono(rawDigits);
    setDuplicateWarning(null);

    if (errors.telefono && rawDigits.length === 9) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.telefono;
        return next;
      });
    }

    if (rawDigits.length === 9) {
      try {
        const res = await buyerService.checkDuplicate({ phone: rawDigits });
        if (res.isDuplicate) {
          setDuplicateWarning('¡Hola de nuevo! Ya tenemos registro de tu contacto. Tu nueva consulta será priorizada.');
        }
      } catch (e) {
        // Silencioso
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!nombre.trim() || nombre.trim().length < 2) {
      newErrors.nombre = 'Ingresa tu nombre para saber cómo llamarte';
    }

    const cleanPhone = telefono.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
      newErrors.telefono = 'Ingresa un celular de 9 dígitos que inicie con 9';
    }

    if (!consentimiento) {
      newErrors.consentimiento = 'Acepta la autorización de contacto para poder responderte';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const reasonLabel = ORIENTATION_REASONS.find((r) => r.id === selectedReason)?.label || 'Orientación';
      const declaredNeed = consultaBreve.trim()
        ? `[${reasonLabel}] ${consultaBreve.trim()}`
        : `[${reasonLabel}] Solicitud de información inicial`;

      const result = await buyerService.registerOpportunity({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        id_sede: idSede ? Number(idSede) : null,
        id_servicio: idServicio ? Number(idServicio) : null,
        motivo_consulta: declaredNeed,
        consentimiento_atencion: true,
      });

      const opId = result.data?.oportunidad?.id_oportunidad || result.data?.id_oportunidad || result.oportunidad?.id_oportunidad;
      const refCode = opId
        ? `OP-${String(opId).padStart(4, '0')}`
        : `OP-${Math.floor(1000 + Math.random() * 9000)}`;

      setSubmittedRef(refCode);
      if (onSuccess) onSuccess(refCode);
    } catch (err: any) {
      setErrors({ form: err.message || 'Error al procesar la solicitud. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedRef(null);
    setNombre('');
    setTelefono('');
    setIdSede('');
    setIdServicio('');
    setConsultaBreve('');
    setConsentimiento(false);
    setDuplicateWarning(null);
  };

  if (submittedRef) {
    const waUrl = `https://wa.me/51944612840?text=${encodeURIComponent(
      `Hola NexoSalud, envié mi solicitud ${submittedRef} (${nombre}) y quisiera recibir orientación directa.`
    )}`;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 via-white to-white p-7 sm:p-9 shadow-xl shadow-slate-200/50"
      >
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Check className="h-8 w-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-block rounded-full bg-emerald-100/80 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
              Solicitud #{submittedRef}
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              ¡Mensaje recibido, {nombre.split(' ')[0]}!
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Un asesor de NexoSalud revisará tu consulta y te responderá por WhatsApp en menos de <strong className="text-slate-900 font-semibold">15 minutos</strong>.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-600 space-y-1.5 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <Clock className="h-4 w-4 text-sky-600 shrink-0" />
              <span>Horario de atención: Lun a Sáb 8:00 AM – 8:00 PM</span>
            </div>
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Tus datos están protegidos bajo la Ley N° 29733</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#25D366]/20 hover:bg-[#20BD5A] transition-all transform active:scale-98"
            >
              <MessageSquare className="h-4 w-4 fill-white" />
              <span>Escribir ahora por WhatsApp con mi código</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>

            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Enviar otra consulta
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-[#d8e6df] bg-[#fffefa] shadow-[0_24px_70px_-35px_rgba(15,76,65,0.42)]">
      <div className="h-1.5 bg-[#146b5d]" aria-hidden="true" />
      <div className="p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#e8f4ef] px-3 py-1 text-[11px] font-semibold text-[#175b4f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#438e69]" />
              ORIENTACIÓN GRATUITA
            </div>
            <h3
              id="buyer-form-heading"
              className="scroll-mt-24 text-xl font-semibold tracking-tight text-[#183c36] sm:text-2xl"
            >
              Empecemos por lo esencial.
            </h3>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-600">
              Cuéntanos qué necesitas y déjanos un número para responderte.
            </p>
          </div>
          <div className="hidden shrink-0 flex-col items-center rounded-2xl border border-[#e1ebe5] bg-white px-3 py-2 text-center sm:flex">
            <Clock className="mb-1 h-4 w-4 text-[#287361]" aria-hidden="true" />
            <span className="text-[10px] font-semibold leading-tight text-slate-700">
              1 minuto
              <br />
              aprox.
            </span>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-3" aria-label={`Paso ${formStep} de 2`}>
          {[1, 2].map((step) => (
            <React.Fragment key={step}>
              {step > 1 && <span className="h-px flex-1 bg-[#e1e9e3]" aria-hidden="true" />}
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    formStep === step
                      ? 'bg-[#176b5b] text-white'
                      : formStep > step
                        ? 'bg-[#e2f0e7] text-[#176b5b]'
                        : 'bg-[#edf0ed] text-slate-500'
                  }`}
                >
                  {formStep > step ? <Check className="h-3.5 w-3.5" /> : step}
                </span>
                <span
                  className={`text-xs font-medium ${
                    formStep === step ? 'text-[#21483c]' : 'text-slate-500'
                  }`}
                >
                  {step === 1 ? 'Tu consulta' : 'Tu contacto'}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait" initial={false}>
            {formStep === 1 ? (
              <motion.div
                key="reason-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                <fieldset>
                  <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#243e38]">
                    <span className="font-mono text-xs text-[#39816d]">01</span>
                    ¿Qué te gustaría resolver?
                    <span className="text-xs font-normal text-slate-400">Elige una opción</span>
                  </legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ORIENTATION_REASONS.map((reason) => {
                      const isSelected = selectedReason === reason.id;
                      const Icon = reason.icon;
                      return (
                        <button
                          key={reason.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedReason(reason.id)}
                          className={`group flex min-h-[68px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361] focus-visible:ring-offset-2 active:scale-[0.99] ${
                            isSelected
                              ? 'border-[#287361] bg-[#edf6f1] text-[#173f36] shadow-[inset_0_0_0_1px_rgba(40,115,97,0.12)]'
                              : 'border-[#e5e9e5] bg-white text-slate-700 hover:border-[#9cbdb0] hover:bg-[#f8fbf8]'
                          } ${reason.id === 'orientacion' ? 'sm:col-span-2' : ''}`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                              isSelected
                                ? 'bg-[#287361] text-white'
                                : 'bg-[#f1f4f1] text-slate-500 group-hover:bg-[#e9f2ed] group-hover:text-[#287361]'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-semibold leading-snug">{reason.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{reason.desc}</span>
                          </span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-[#287361]" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Button
                  type="button"
                  onClick={() => {
                    setFormStep(2);
                    requestAnimationFrame(() => {
                      document.getElementById('buyer-form-heading')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      });
                    });
                  }}
                  className="h-12 w-full rounded-2xl bg-[#176b5b] text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(23,107,91,0.65)] transition-all hover:bg-[#12594c] active:translate-y-px sm:h-14 sm:text-base"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center text-xs text-slate-500">
                  No tienes que saber el tratamiento exacto para continuar.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="contact-step"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="space-y-6"
              >
                <button
                  type="button"
                  onClick={() => setFormStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#176451] transition-colors hover:text-[#104a3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361] focus-visible:ring-offset-2"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  Cambiar motivo de consulta
                </button>

                <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#243e38]">
              <span className="font-mono text-xs text-[#39816d]">01</span>
              ¿Cómo te contactamos?
              <span className="text-xs font-normal text-slate-400">Obligatorio</span>
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="buyer-nombre" className="text-[13px] font-medium text-slate-700">
                  Tu nombre
                  <span className="ml-1 text-rose-600" aria-label="obligatorio">*</span>
                </Label>
                <Input
                  id="buyer-nombre"
                  type="text"
                  autoComplete="name"
                  placeholder="Ej. Ana Morales"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  aria-invalid={Boolean(errors.nombre)}
                  aria-describedby={errors.nombre ? 'buyer-nombre-error' : undefined}
                  className={`h-12 rounded-xl bg-white px-3.5 text-sm placeholder:text-slate-400 ${
                    errors.nombre
                      ? 'border-rose-400 focus-visible:ring-rose-400'
                      : 'border-[#dce4de] focus-visible:ring-[#287361]'
                  }`}
                  disabled={submitting}
                />
                {errors.nombre && (
                  <p id="buyer-nombre-error" role="alert" className="text-xs font-medium text-rose-700">
                    {errors.nombre}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer-phone" className="text-[13px] font-medium text-slate-700">
                  WhatsApp o celular
                  <span className="ml-1 text-rose-600" aria-label="obligatorio">*</span>
                </Label>
                <div
                  className={`flex h-12 items-center overflow-hidden rounded-xl border bg-white focus-within:ring-2 focus-within:ring-[#287361] focus-within:ring-offset-1 ${
                    errors.telefono ? 'border-rose-400 focus-within:ring-rose-400' : 'border-[#dce4de]'
                  }`}
                >
                  <span className="flex h-full items-center border-r border-[#e8ece8] px-3 text-sm font-medium text-slate-500">
                    +51
                  </span>
                  <Input
                    id="buyer-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="987 654 321"
                    value={telefono}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    maxLength={9}
                    aria-invalid={Boolean(errors.telefono)}
                    aria-describedby={
                      errors.telefono ? 'buyer-phone-error' : 'buyer-phone-hint'
                    }
                    className="h-full rounded-none border-0 bg-transparent px-3 text-sm font-mono tracking-wide shadow-none focus-visible:ring-0"
                    disabled={submitting}
                  />
                </div>
                {errors.telefono ? (
                  <p id="buyer-phone-error" role="alert" className="text-xs font-medium text-rose-700">
                    {errors.telefono}
                  </p>
                ) : (
                  <p id="buyer-phone-hint" className="text-[11px] text-slate-500">
                    Te escribiremos por WhatsApp. No compartimos tu número.
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          {duplicateWarning && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-dashed border-[#b8cec1] bg-[#f7faf6]">
            <button
              type="button"
              aria-expanded={showOptionalFields}
              aria-controls="buyer-extra-fields"
              onClick={() => setShowOptionalFields((open) => !open)}
              className="flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#eff5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#287361]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#287361] shadow-sm">
                  <Building2 className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-[#29443a]">
                    Agregar preferencias
                    <span className="ml-1.5 font-normal text-slate-500">(opcional)</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                    Sede, tratamiento o un detalle para el asesor
                  </span>
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#287361] transition-transform duration-200 ${
                  showOptionalFields ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence initial={false}>
              {showOptionalFields && (
                <motion.div
                  id="buyer-extra-fields"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-4 border-t border-[#e1e9e1] px-4 py-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="buyer-sede" className="text-[13px] font-medium text-slate-700">
                        Sede preferida
                      </Label>
                      <select
                        id="buyer-sede"
                        value={idSede}
                        onChange={(e) => setIdSede(e.target.value ? Number(e.target.value) : '')}
                        className="h-12 w-full rounded-xl border border-[#dce4de] bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-[#287361] focus:ring-offset-1"
                        disabled={submitting}
                      >
                        <option value="">Cualquiera en Trujillo</option>
                        {sedes.map((s) => (
                          <option key={s.id_sede} value={s.id_sede}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="buyer-servicio" className="text-[13px] font-medium text-slate-700">
                        Tratamiento de interés
                      </Label>
                      <select
                        id="buyer-servicio"
                        value={idServicio}
                        onChange={(e) => setIdServicio(e.target.value ? Number(e.target.value) : '')}
                        className="h-12 w-full rounded-xl border border-[#dce4de] bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:ring-2 focus:ring-[#287361] focus:ring-offset-1"
                        disabled={submitting}
                      >
                        <option value="">Aún no lo sé</option>
                        {servicios.map((srv) => (
                          <option key={srv.id_servicio} value={srv.id_servicio}>
                            {srv.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="buyer-consulta" className="text-[13px] font-medium text-slate-700">
                          ¿Algo más que debamos saber?
                        </Label>
                        <span className="font-mono text-[11px] text-slate-500">
                          {consultaBreve.length}/200
                        </span>
                      </div>
                      <textarea
                        id="buyer-consulta"
                        maxLength={200}
                        rows={3}
                        placeholder="Escribe aquí si tienes una duda concreta. También puedes dejarlo en blanco."
                        value={consultaBreve}
                        onChange={(e) => setConsultaBreve(e.target.value)}
                        className="w-full resize-y rounded-xl border border-[#dce4de] bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-[#287361] focus:ring-offset-1"
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-3 rounded-xl bg-[#f4f7f3] px-3.5 py-3">
              <input
                id="buyer-consentimiento"
                type="checkbox"
                checked={consentimiento}
                onChange={(e) => {
                  setConsentimiento(e.target.checked);
                  if (e.target.checked && errors.consentimiento) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.consentimiento;
                      return next;
                    });
                  }
                }}
                aria-invalid={Boolean(errors.consentimiento)}
                aria-describedby={errors.consentimiento ? 'buyer-consent-error' : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#287361] accent-[#287361] focus:ring-[#287361]"
                disabled={submitting}
              />
              <div className="text-xs leading-relaxed text-slate-600">
                <label htmlFor="buyer-consentimiento" className="cursor-pointer">
                  Autorizo que NexoSalud me contacte para responder esta consulta, conforme a la Ley N.° 29733.
                </label>{' '}
                <button
                  type="button"
                  onClick={() => setPrivacyModalOpen(true)}
                  className="font-semibold text-[#176451] underline decoration-[#9ab9a8] underline-offset-2 hover:text-[#104a3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287361]"
                >
                  Ver cómo protegemos tus datos
                </button>
              </div>
            </div>
            {errors.consentimiento && (
              <p id="buyer-consent-error" role="alert" className="pl-1 text-xs font-medium text-rose-700">
                {errors.consentimiento}
              </p>
            )}
          </div>

          {errors.form && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-relaxed text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errors.form}</span>
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-2xl bg-[#176b5b] text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(23,107,91,0.65)] transition-all hover:bg-[#12594c] active:translate-y-px disabled:opacity-70 sm:h-14 sm:text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enviando tu consulta...</span>
                </>
              ) : (
                <>
                  <span>Quiero recibir orientación</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#287361]" />
                Tus datos, siempre privados
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#287361]" />
                Respuesta por WhatsApp
              </span>
            </div>
          </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Modal accesible de Política de Privacidad */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Protección de Datos Personales (Ley N° 29733)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              NexoSalud Odontología Especializada · Trujillo, Perú
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-600 max-h-[60vh] overflow-y-auto pr-1 leading-relaxed">
            <p>
              En cumplimiento de la <strong>Ley N° 29733</strong>, le informamos que sus datos serán tratados con las siguientes garantías:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Finalidad exclusiva:</strong> Responder sus dudas sobre tratamientos odontológicos, presupuestos y coordinación de turnos.
              </li>
              <li>
                <strong>Cero cesión:</strong> Jamás venderemos ni transferiremos sus datos a empresas terceras o publicidad ajena a su salud dental.
              </li>
              <li>
                <strong>Seguridad y confidencialidad:</strong> Almacenamiento seguro bajo estricto secreto profesional médico.
              </li>
              <li>
                <strong>Derechos ARCO:</strong> Puede solicitar la eliminación o actualización de sus datos en cualquier momento escribiendo a <span className="font-mono text-slate-800">privacidad@nexosalud.pe</span>.
              </li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrivacyModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
