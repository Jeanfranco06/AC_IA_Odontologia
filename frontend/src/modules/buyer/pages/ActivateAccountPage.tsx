import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { patientAuthApi } from '@/shared/services/patientAuthService';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  User,
  Sparkles
} from 'lucide-react';

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token') || '';

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<any>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setCheckingToken(false);
      setTokenValid(false);
      setTokenError('No se proporcionó ningún token de activación en el enlace.');
      return;
    }

    patientAuthApi.validateToken(token)
      .then((res) => {
        if (res.valid && res.patient) {
          setTokenValid(true);
          setPatientData(res.patient);
        } else {
          setTokenValid(false);
          setTokenError(res.message || 'El enlace de activación no es válido o ya caducó.');
        }
      })
      .catch((err) => {
        setTokenValid(false);
        setTokenError(err.message || 'Error al validar el enlace de activación.');
      })
      .finally(() => {
        setCheckingToken(false);
      });
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast({
        title: 'Contraseña muy corta',
        description: 'La contraseña debe tener al menos 6 caracteres para tu seguridad médica.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Las contraseñas no coinciden',
        description: 'Verifica que ambas contraseñas sean idénticas.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await patientAuthApi.activatePassword(token, password);
      setSuccess(true);
      toast({
        title: '¡Cuenta Activada con Éxito!',
        description: 'Tu contraseña personal ha sido configurada. Ya puedes ingresar a tu Portal del Paciente.',
      });
    } catch (err: any) {
      toast({
        title: 'Error de activación',
        description: err.message || 'No se pudo guardar la contraseña. Inténtalo nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen w-full bg-slate-50 flex flex-col items-center justify-center p-4">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white selection:bg-teal-500/20 selection:text-teal-900">
      
      {/* PANEL IZQUIERDO: Fotografía Odontológica a pantalla completa (50% en desktop, 100vh) */}
      <div className="relative hidden md:flex md:w-1/2 lg:w-5/12 flex-col justify-between p-8 lg:p-12 xl:p-16 text-white overflow-hidden bg-slate-950 min-h-screen shrink-0">
        <img 
          src="/Fondo_NexoSalud_3.jpg" 
          alt="Instrumental Odontológico NexoSalud" 
          className="absolute inset-0 w-full h-full object-cover object-center scale-100 opacity-80 transition-transform duration-1000 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-900/30" />

        {/* Top Brand Tag */}
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-3.5 p-2.5 pr-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl">
            <div className="p-2 rounded-xl bg-white shadow-xs">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <span className="font-black text-base text-white tracking-tight block">NexoSalud Dental</span>
              <span className="text-[11px] text-teal-300 font-medium block">Portal Digital del Paciente</span>
            </div>
          </div>
        </div>

        {/* Bottom Highlights */}
        <div className="relative z-10 space-y-5 max-w-md">
          <Badge className="bg-teal-500/20 text-teal-300 border border-teal-400/30 text-xs px-3.5 py-1 rounded-full backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-400" /> Expediente Clínico Protegido
          </Badge>

          <div className="space-y-2.5">
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">
              Tu Salud Dental en un Solo Lugar
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-light">
              Configura tu contraseña para acceder a tus recetas médicas, recomendaciones post-consulta y agendar atenciones futuras de manera inmediata.
            </p>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Historial de atenciones y odontograma</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Agendamiento express de citas médicas</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Cifrado y privacidad de nivel clínico</span>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL DERECHO: Formulario Blanco a pantalla completa */}
      <div className="flex-1 min-h-screen flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14 xl:p-20 bg-white">
        
        <div className="w-full max-w-md space-y-6">
          
          {/* Header móvil */}
          <div className="md:hidden text-center space-y-2 mb-4">
            <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-white shadow-md ring-1 ring-slate-200 border border-slate-100">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="h-8 w-8 object-contain" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              NexoSalud <span className="text-teal-600 font-extrabold">Dental</span>
            </h1>
          </div>

          {!tokenValid ? (
            /* Error en Token */
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">Enlace No Válido o Expirado</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  {tokenError || 'Este enlace de activación ya fue utilizado o caducó por límite de tiempo (24h).'}
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/solicitar-informacion')}
                  className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-2 cursor-pointer shadow-md shadow-teal-700/20 transition-all hover:shadow-lg"
                >
                  <span>Ir al Portal del Paciente</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : success ? (
            /* Éxito */
            <div className="text-center space-y-5 py-4 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center mx-auto shadow-md shadow-teal-500/10">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <Badge className="bg-teal-50 text-teal-700 border border-teal-200/80 text-[10px] px-3 py-0.5 rounded-full font-semibold">
                  <Sparkles className="w-3 h-3 mr-1 text-teal-600" /> Cuenta Activada
                </Badge>
                <h2 className="text-2xl font-black text-slate-900">¡Contraseña Guardada!</h2>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Tu cuenta ha quedado activada. A partir de ahora podrás iniciar sesión con tu <strong>DNI ({patientData?.dni})</strong> y tu nueva contraseña.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => navigate('/solicitar-informacion')}
                  className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs gap-2 cursor-pointer shadow-lg shadow-teal-700/25 transition-all hover:scale-[1.01]"
                >
                  <span>Iniciar Sesión en el Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Formulario de Activación */
            <div className="space-y-6">
              
              {/* Título de Formulario */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-teal-700 tracking-wider uppercase flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5" /> Paso Final de Seguridad
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Crea tu Contraseña
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Ingresa tu nueva clave de acceso para proteger tu expediente clínico.
                </p>
              </div>

              {/* Ficha Resumen del Paciente */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 shadow-xs">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{patientData?.fullName}</p>
                  <p className="text-xs text-slate-500 font-mono">DNI: {patientData?.dni}</p>
                </div>
              </div>

              {/* Formulario */}
              <form onSubmit={handleActivate} className="space-y-4">
                
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-teal-600" />
                    Nueva Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 pr-10 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                    Confirmar Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repite tu nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-11 rounded-xl text-xs bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 pr-10 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/80 border border-teal-100/90 text-teal-900 text-[11px] leading-relaxed flex items-start gap-2.5">
                  <span className="shrink-0 text-sm">💡</span>
                  <span>Esta contraseña te servirá para ingresar siempre que desees consultar tus recetas, radiografías o pedir atenciones rápidas.</span>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm gap-2 shadow-lg shadow-teal-700/20 cursor-pointer transition-all hover:scale-[1.01]"
                  >
                    {submitting ? (
                      <span>Guardando contraseña...</span>
                    ) : (
                      <>
                        <span>Activar y Guardar Contraseña</span>
                        <CheckCircle2 className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>

              </form>
            </div>
          )}

        </div>

      </div>

      <Toaster />
    </div>
  );
}

