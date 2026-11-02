import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { CreditCard, Smartphone, Sparkles, Loader2, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { QUERY_KEYS } from '@/shared/constants';
import { useTheme } from '@/shared/context/ThemeContext';

// Inicializar Mercado Pago Checkout API con la Public Key
const MP_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || 'TEST-2057dc67-b4dd-4efa-972d-5ce965d7ab15';
if (typeof window !== 'undefined' && MP_PUBLIC_KEY) {
  try {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
  } catch (err) {
    console.error('Error inicializando Mercado Pago SDK:', err);
  }
}

// Logos originales de marcas de pago
export function YapeLogoBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`inline-flex items-center gap-1 font-black bg-[#742284] text-white rounded-lg tracking-tight shadow-xs ${
      size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
    }`}>
      <span className="text-[#00d4a1] text-xs">●</span> yape
    </span>
  );
}

export function VisaLogo() {
  return (
    <span className="inline-flex items-center justify-center font-black italic text-[11px] text-[#1A1F71] dark:text-[#6c8cff] bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-xs tracking-tighter">
      VISA
    </span>
  );
}

export function MastercardLogo() {
  return (
    <span className="inline-flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-xs">
      <svg className="w-5 h-3.5" viewBox="0 0 24 15" fill="none">
        <circle cx="7.5" cy="7.5" r="7" fill="#EB001B" />
        <circle cx="16.5" cy="7.5" r="7" fill="#F79E1B" fillOpacity="0.88" />
      </svg>
    </span>
  );
}

export function AmexLogo() {
  return (
    <span className="inline-flex items-center justify-center font-black text-[9px] text-[#006FCF] dark:text-[#38bdf8] bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-1.5 py-0.5 rounded shadow-xs tracking-tight">
      AMEX
    </span>
  );
}

interface YapePaymentButtonProps {
  payerId: string;
  personName: string;
  email?: string;
  amount?: number;
  serviceName?: string;
  onSuccess?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function YapePaymentButton({
  payerId,
  personName,
  email = 'paciente@nexosalud.com',
  amount = 2.00,
  serviceName = 'Servicio Odontológico',
  onSuccess
}: YapePaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'yape' | 'card'>('yape');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const finalAmount = Math.max(Number(amount) || 2, 2);

  useEffect(() => {
    if (MP_PUBLIC_KEY) {
      try {
        initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
      } catch (e) {
        // Already initialized
      }
    }
  }, []);

  // 1. Procesar Pago Directo con YAPE
  const handleDirectYapePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast({
        title: 'Código Incompleto',
        description: 'Ingresa los 6 dígitos del código de aprobación que genera tu app de Yape (o código de prueba 123456).',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/payments/process-yape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          amount: finalAmount,
          phone,
          otpCode,
          email
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo procesar el pago con Yape.');
      }

      // Validar en el backend de SQL Server
      await fetch(`${API_URL}/payer/${payerId}/validate`, { method: 'POST' });

      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });

      toast({
        title: '¡Pago Exitoso con Yape! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} procesado correctamente. Cita VALIDADA en SQL Server.`,
      });

      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error en el Pago con Yape',
        description: error.message || 'Verifica el código de aprobación de Yape o tu saldo.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Procesar Pago con Tarjeta (Checkout API)
  const handleProcessCheckoutApi = async (param: any) => {
    const { formData } = param;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/payments/process-checkout-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          formData,
          amount: Math.max(Number(amount) || 1, 1),
          serviceName,
          email: formData?.payer?.email || email || 'paciente@nexosalud.com'
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo procesar el pago con la pasarela.');
      }

      // Validar en el backend de SQL Server
      await fetch(`${API_URL}/payer/${payerId}/validate`, { method: 'POST' });

      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });

      toast({
        title: '¡Pago Exitoso con Tarjeta! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} procesado correctamente. Cita VALIDADA en SQL Server.`,
      });

      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error('Error Checkout API:', error);
      toast({
        title: 'Error al procesar pago',
        description: error.message || 'Verifica los datos de la tarjeta o medio de pago.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/payer/${payerId}/validate`, { method: 'POST' });
      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      toast({
        title: '¡Pago Aprobado (Modo Demo)! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} registrado exitosamente en SQL Server. Cita VALIDADA.`,
      });
      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1200);
    } catch (e) {
      toast({ title: 'Error', description: 'Error al simular pago', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Tarjeta de Pasarela Oficial en Vista PAYER */}
      <div className="p-4 sm:p-5 rounded-2xl border border-purple-200/90 dark:border-purple-900/60 bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-slate-50/60 dark:from-purple-950/30 dark:via-slate-900/90 dark:to-indigo-950/20 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Métodos Aceptados:
              </span>
              <YapeLogoBadge />
              <VisaLogo />
              <MastercardLogo />
              <AmexLogo />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 pt-1">
              Pasarela Oficial Integrada (Yape & Checkout API)
              <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Paga <span className="font-bold text-[#742284] dark:text-purple-300">S/ {amount.toFixed(2)}</span> de forma directa y segura.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-lg self-start">
            <Lock className="w-3 h-3" /> Encriptación SSL
          </div>
        </div>

        {/* Botón Pagar S/ X.XX */}
        <Button
          onClick={() => setIsOpen(true)}
          className="w-full bg-[#742284] hover:bg-[#5e196c] dark:bg-[#742284] dark:hover:bg-[#8b2aa0] text-white font-bold text-sm flex items-center justify-center gap-2 py-4 h-11 rounded-xl shadow-md transition-all transform active:scale-[0.98]"
        >
          <Smartphone className="w-4 h-4" />
          Pagar S/ {amount.toFixed(2)}
        </Button>
      </div>

      {/* Modal Interactivo de Pasarela de Pago */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          {/* Header Fijo */}
          <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#742284]/10 dark:bg-[#742284]/30 text-[#742284] dark:text-purple-300 ring-4 ring-purple-50 dark:ring-purple-950/40 border border-purple-200/60 dark:border-purple-800/60">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    Pasarela de Pago Segura
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Elige tu método de pago preferido. 100% integrado sin salir de la plataforma.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {isApproved ? (
            <div className="py-12 px-6 text-center space-y-3 animate-in fade-in zoom-in">
              <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">¡Pago Confirmado y Validado!</h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Cobro procesado con éxito. Actualizando sistema...</p>
            </div>
          ) : (
            <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-4">
              {/* Selector de Método: YAPE vs TARJETA */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('yape')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'yape'
                      ? 'bg-[#742284] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <YapeLogoBadge />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
                    activeTab === 'card'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-sky-500" />
                  <span>Tarjeta Débito / Crédito</span>
                </button>
              </div>

              {/* Resumen del Paciente & Monto */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px]">Paciente: <strong className="text-slate-900 dark:text-white font-semibold">{personName}</strong></p>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Servicio: <strong className="text-slate-900 dark:text-white font-semibold">{serviceName}</strong></p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Monto Total:</span>
                  <p className="text-xl font-extrabold text-[#742284] dark:text-purple-400 font-mono">S/ {amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Pestaña 1: YAPE DIRECTO */}
              {activeTab === 'yape' && (
                <form onSubmit={handleDirectYapePay} className="space-y-4 pt-1 animate-in fade-in">
                  <div className="bg-purple-50/80 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-200/80 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-[#742284] dark:text-purple-300">
                      <ShieldCheck className="w-4 h-4 text-[#742284] dark:text-[#00d4a1]" />
                      ¿Cómo pagar con Yape?
                    </p>
                    <p className="text-purple-800 dark:text-purple-300 leading-relaxed text-[11px]">
                      Abre tu app <strong>Yape</strong>, ve a <strong>"Código de aprobación"</strong> e ingresa el código de 6 dígitos.
                      <em> (En modo prueba puedes usar: <strong>123456</strong>)</em>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="yape-phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Número de Celular Yape</Label>
                    <Input
                      id="yape-phone"
                      type="tel"
                      placeholder="987654321"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="text-sm font-medium bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="yape-otp" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Código de Aprobación de Yape (6 dígitos)</Label>
                    <Input
                      id="yape-otp"
                      type="text"
                      maxLength={6}
                      placeholder="Ej: 123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="text-lg tracking-widest text-center font-bold font-mono text-[#742284] dark:text-purple-300 bg-slate-50 dark:bg-slate-800 border-purple-300 dark:border-purple-600/80 focus:ring-2 focus:ring-[#742284] rounded-xl"
                      required
                    />
                  </div>

                  {/* Botón Pagar S/ X.XX */}
                  <Button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full bg-[#742284] hover:bg-[#5e196c] dark:bg-[#742284] dark:hover:bg-[#8b2aa0] text-white font-bold py-4 h-11 shadow-md flex items-center justify-center gap-2 rounded-xl text-xs transition-all transform active:scale-[0.98]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando pago con Yape...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Pagar S/ {amount.toFixed(2)}
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Pestaña 2: TARJETA CHECKOUT API */}
              {activeTab === 'card' && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Tarjetas aceptadas:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <VisaLogo />
                      <MastercardLogo />
                      <AmexLogo />
                    </div>
                  </div>

                  <div className="min-h-[220px] relative rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                    {loading && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-600 dark:text-sky-400" />
                      </div>
                    )}
                    
                    <CardPayment
                      key={theme}
                      initialization={{
                        amount: Math.max(Number(amount) || 1, 1),
                        payer: {
                          email: (email && email.includes('@')) ? email : 'paciente@nexosalud.com',
                        },
                      }}
                      customization={{
                        visual: {
                          style: {
                            theme: (theme === 'dark' ? 'dark' : 'default') as any,
                            customVariables: theme === 'dark' ? {
                              baseColor: '#742284',
                              formBackgroundColor: '#0f172a',
                              formPadding: '12px',
                              borderRadius: '12px',
                            } : {
                              baseColor: '#742284',
                              borderRadius: '12px',
                            }
                          }
                        },
                        paymentMethods: {
                          maxInstallments: 1
                        }
                      }}
                      onSubmit={async (formData) => {
                        await handleProcessCheckoutApi({ formData });
                      }}
                      onError={(error) => {
                        console.error('Error CardPayment Mercado Pago:', error);
                      }}
                      onReady={() => {
                        console.log('CardPayment Brick cargado correctamente.');
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Botón de Simulación Rápida para Exposición */}
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulate}
                  disabled={loading}
                  className="w-full border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs py-2.5 rounded-xl flex items-center gap-1.5 justify-center transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  ⚡ Simular Aprobación Instantánea (Para Demo / Exposición en Clase)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

