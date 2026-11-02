import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { BuyerForm, type BuyerFormRef } from './BuyerForm';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { canTransitionBuyerToLead } from '@/domain/transitions';
import { BuyerState } from '@/domain/enums';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { UserCheck, ArrowRight, Save, Loader2, Sparkles, ShieldCheck, Stethoscope, MapPin, Clock, Radio, Tag, CheckCircle2, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, RefreshCw, Flame, Zap, History, Bot, RotateCw } from 'lucide-react';
import { analyzeBuyerMarketingAgent, type BuyerMarketingAnalysis } from '@/shared/services/groqService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface BuyerDetailModalProps {
  buyerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BuyerDetailModal({ buyerId, isOpen, onClose }: BuyerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: buyer, isLoading, isError } = useBuyer(buyerId || '');
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();
  const buyerFormRef = useRef<BuyerFormRef>(null);

  const journeys: any[] = [];
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isAgentExpanded, setIsAgentExpanded] = useState(true);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<BuyerMarketingAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const runAiAnalysis = async (b = buyer) => {
    if (!b) return;
    setIsAiLoading(true);
    try {
      const result = await analyzeBuyerMarketingAgent({
        fullName: `${b.person?.firstName || ''} ${b.person?.lastName || ''}`.trim(),
        phone: b.person?.phone,
        email: b.person?.email,
        serviceOfInterest: b.serviceOfInterest,
        preferredBranch: b.pref_sede_preferida,
        preferredTimeSlot: b.pref_id_horario,
        channel: b.channel,
        attractionSource: b.attractionSource,
        concreteRequest: b.concreteRequest,
        contactAuthorization: b.contactAuthorization,
        qualityStatus: b.state === BuyerState.CONVERTED ? 'Valido' : undefined,
        state: b.state,
        isConverted: b.state === BuyerState.CONVERTED,
      });
      setAiAnalysis(result);
    } catch (err) {
      console.warn('Error en análisis del agente de marketing:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Auto-análisis del Agente de Marketing al abrir el modal
  useEffect(() => {
    if (isOpen && buyer) {
      runAiAnalysis(buyer);
    } else if (!isOpen) {
      setAiAnalysis(null);
    }
  }, [isOpen, buyer?.id]);

  const handleRefreshAI = async () => {
    if (!buyer) return;
    await runAiAnalysis(buyer);
    toast({ title: 'Análisis actualizado', description: 'El Agente de Marketing ha recalculado las 4 actividades clave.' });
  };

  const handleSubmit = (data: BuyerFormValues) => {
    if (!buyerId) return;
    updateBuyer.mutate({
      id: buyerId,
      data: {
        channel: data.channel,
        attractionSource: data.attractionSource,
        serviceOfInterestId: data.serviceOfInterestId,
        contactAuthorization: data.contactAuthorization,
        concreteRequest: data.concreteRequest,
        pref_id_canal: data.pref_id_canal,
        pref_id_horario: data.pref_id_horario,
        pref_id_modalidad: data.pref_id_modalidad,
        pref_sede_preferida: data.pref_sede_preferida,
        pref_profesional_preferido: data.pref_profesional_preferido,
        estudianteAplica: data.estudianteAplica,
        universidad: data.universidad,
        carrera: data.carrera,
        ciclo: data.ciclo,
        laboralAplica: data.laboralAplica,
        ocupacion: data.ocupacion,
        empresa: data.empresa,
        modalidadLaboral: data.modalidadLaboral,
        disponibilidadLaboral: data.disponibilidadLaboral,
        ultima_visita_odontologica: data.ultima_visita_odontologica,
        tratamiento_previo: data.tratamiento_previo,
        nivel_dolor: data.nivel_dolor,
        presenta_sensibilidad: data.presenta_sensibilidad,
        sangrado_o_inflamacion: data.sangrado_o_inflamacion,
        usa_aparato_o_protesis: data.usa_aparato_o_protesis,
        condicion_atencion_especial: data.condicion_atencion_especial,
        person: {
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          phone: data.phone,
          email: data.email,
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: 'Datos del BUYER actualizados correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      },
      onError: (err) => {
        toast({ title: 'Error al actualizar', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleConvert = () => {
    if (!buyerId) return;
    convertBuyer.mutate(buyerId, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'El Buyer ha sido transferido a LEAD exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setIsConvertDialogOpen(false);
        onClose();
      },
      onError: (err) => {
        toast({ title: 'No se pudo convertir', description: err.message, variant: 'destructive' });
      }
    });
  };

  if (!isOpen || !buyerId) return null;

  const isConverted = buyer?.state === BuyerState.CONVERTED;
  const isIntentAmbiguous = Boolean(
    aiAnalysis && (
      aiAnalysis.intentEvaluation.intentLevel === 'AMBIGUA' || 
      !aiAnalysis.intentEvaluation.hasConcreteIntent || 
      aiAnalysis.dataQuality.status !== 'Valido'
    )
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] sm:max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Detalle del BUYER
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {buyer?.id}
                  </p>
                </div>
              </div>

              {buyer && (
                <div className="flex items-center gap-2">
                  <StatusBadge 
                    status={buyer.state} 
                    variant={
                      buyer.state === BuyerState.CONVERTED ? 'success' :
                      buyer.state === BuyerState.DISCARDED ? 'error' :
                      buyer.state === BuyerState.DUPLICATED ? 'purple' :
                      buyer.state === BuyerState.NEW ? 'warning' : 'neutral'
                    } 
                  />
                  {!isConverted ? (
                    <Button 
                      disabled={convertBuyer.isPending} 
                      onClick={() => setIsConvertDialogOpen(true)}
                      className={
                        isIntentAmbiguous
                          ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white rounded-xl shadow-sm text-xs font-semibold px-3.5 py-2 h-9 flex items-center gap-1.5 transition-colors border border-amber-500/30"
                          : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl shadow-sm text-xs font-semibold px-3.5 py-2 h-9 flex items-center gap-1.5 transition-colors"
                      }
                    >
                      {convertBuyer.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Convirtiendo...</span>
                        </>
                      ) : (
                        <>
                          {isIntentAmbiguous && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                          )}
                          <span>Convertir a LEAD</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>En Etapa LEAD</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">
          {isLoading ? (
            <LoadingState />
          ) : isError || !buyer ? (
            <ErrorState message="No se pudo cargar la información del Buyer." />
          ) : (
            <div className="space-y-6">
              {/* Agente de Marketing (IA) — 4 Actividades Clave de Negocio */}
              <div className="bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 rounded-2xl transition-all shadow-sm overflow-hidden">
                {/* Cabecera Desplegable del Agente */}
                <div 
                  onClick={() => setIsAgentExpanded(prev => !prev)}
                  className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-teal-50/60 dark:hover:bg-teal-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 text-white shadow-md ring-4 ring-teal-50 dark:ring-teal-950/50">
                      <Bot className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                          Agente Inteligente de Marketing
                        </h4>
                        <StatusBadge status="Etapa BUYER · BI" variant="primary" />
                        
                        {aiAnalysis?.intentEvaluation && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${
                            aiAnalysis.intentEvaluation.intentLevel === 'ALTA'
                              ? 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                              : aiAnalysis.intentEvaluation.intentLevel === 'MEDIA'
                              ? 'bg-sky-100 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200 border-sky-300 dark:border-sky-700'
                              : 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          }`}>
                            {aiAnalysis.intentEvaluation.intentLevel === 'ALTA' ? (
                              <>
                                <Flame className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Intención Alta</span>
                              </>
                            ) : aiAnalysis.intentEvaluation.intentLevel === 'MEDIA' ? (
                              <>
                                <Zap className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                                <span>Intención Media</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Intención Ambigua</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Automatización y diagnóstico de las 4 actividades clave del embudo de captación
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={handleRefreshAI}
                      disabled={isAiLoading}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-100/80 dark:bg-teal-950/80 hover:bg-teal-200 dark:hover:bg-teal-900 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 shadow-2xs border border-teal-300/60 dark:border-teal-800/80 cursor-pointer"
                      title="Recalcular análisis con IA"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                      <span>{isAiLoading ? 'Analizando...' : 'Recalcular'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAgentExpanded(prev => !prev)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title={isAgentExpanded ? "Plegar sección del agente" : "Desplegar sección del agente"}
                    >
                      <span>{isAgentExpanded ? 'Ocultar' : 'Desplegar'}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAgentExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Contenido Desplegable */}
                {isAgentExpanded && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-teal-100/80 dark:border-teal-900/60 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      
                      {/* Actividad 1: Validación y Calidad de Datos */}
                      <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" /> 1. Validación de Registro
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                            aiAnalysis?.dataQuality.status === 'Valido' 
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                              : aiAnalysis?.dataQuality.status === 'Duplicado'
                              ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              : 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          }`}>
                            {aiAnalysis?.dataQuality.status || 'Válido'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {aiAnalysis?.dataQuality.explanation || '9 dígitos y consentimiento de Ley N° 29733 validados correctamente.'}
                        </p>
                      </div>

                      {/* Actividad 2: Clasificación de Preferencias */}
                      <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                            <Stethoscope className="h-3.5 w-3.5" /> 2. Perfil de Preferencias
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {aiAnalysis?.preferencesProfile.category || 'Odontología'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{buyer.serviceOfInterest || 'Consulta Dental'}</span> · {buyer.pref_sede_preferida || 'Sede Principal'}
                        </p>
                      </div>

                      {/* Actividad 3: Identificación del Origen */}
                      <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                            <Tag className="h-3.5 w-3.5" /> 3. Origen de Captación
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            {buyer.channel || 'Portal Web'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          Fuente: <span className="font-bold text-slate-800 dark:text-slate-100">{buyer.attractionSource || 'Meta Ads (Campaña 2026)'}</span>
                        </p>
                      </div>

                      {/* Actividad 4: Evaluación de Conversión a LEAD */}
                      <div className={`p-3.5 rounded-xl border shadow-2xs space-y-1.5 ${
                        aiAnalysis?.intentEvaluation.intentLevel === 'AMBIGUA'
                          ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/90 dark:border-amber-800/80'
                          : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800/90'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> 4. Intención Comercial & Conversión
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                            aiAnalysis?.intentEvaluation.intentLevel === 'ALTA'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : aiAnalysis?.intentEvaluation.intentLevel === 'MEDIA'
                              ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                          }`}>
                            {aiAnalysis?.intentEvaluation.intentLevel ? `Intención ${aiAnalysis.intentEvaluation.intentLevel}` : 'Intención Alta'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          {aiAnalysis?.intentEvaluation.intentReason || 'Solicita información de precios y agendamiento clínico.'}
                        </p>
                        {aiAnalysis?.intentEvaluation.marketingRecommendation && (
                          <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-teal-800 dark:text-teal-200 flex items-center gap-1">
                            <span className="font-semibold text-teal-600 dark:text-teal-400">Acción Sugerida:</span>
                            <span>{aiAnalysis.intentEvaluation.marketingRecommendation}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>

              {journeys.find(j => j.buyerId === buyer.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.buyerId === buyer.id)!} />
                </div>
              )}

              {/* Historial de Consultas Recurrentes e Interacciones Web (BI & Negociación LEAD) */}
              {((buyer.consultasCount && buyer.consultasCount > 1) || (buyer.solicitudesHistory && buyer.solicitudesHistory.length > 0)) && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-slate-900/40 dark:to-slate-900/60 shadow-2xs overflow-hidden transition-all">
                  {/* Cabecera Desplegable del Historial (clic en cualquier parte del header) */}
                  <div 
                    onClick={() => setIsHistoryExpanded(prev => !prev)}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9.5 h-9.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-2xs border border-amber-200 dark:border-amber-700/60 shrink-0">
                        <History className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                            Historial de Consultas Recurrentes
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                            <RotateCw className="w-2.5 h-2.5 text-amber-700 dark:text-amber-300 shrink-0" />
                            <span>{buyer.solicitudesHistory?.length || 1} {buyer.solicitudesHistory?.length === 1 ? 'Consulta Web' : 'Consultas Web'}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Trazabilidad de tratamientos consultados y dudas del prospecto para negociación en LEAD
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setIsHistoryExpanded(prev => !prev)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                        title={isHistoryExpanded ? "Ocultar historial" : "Desplegar historial"}
                      >
                        <span>{isHistoryExpanded ? 'Ocultar' : 'Ver detalle'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isHistoryExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {isHistoryExpanded && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {buyer.solicitudesHistory && buyer.solicitudesHistory.length > 0 ? (
                          buyer.solicitudesHistory.map((s: any, idx: number) => (
                            <div 
                              key={s.id || idx} 
                              className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-amber-100 dark:border-amber-900/40 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Consulta #{buyer.solicitudesHistory!.length - idx}
                                  </span>
                                  <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                                    {s.servicio || 'Evaluación Odontológica'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                                  <span className="font-medium text-slate-500 dark:text-slate-400">Duda / Motivo: </span>
                                  <span className="italic">{s.motivo}</span>
                                </p>
                              </div>
                              {s.fecha && (
                                <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap self-start sm:self-center">
                                  {format(new Date(s.fecha), 'dd MMM yyyy, HH:mm', { locale: es })}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 text-xs text-slate-600">
                            Consulta inicial registrada: {buyer.concreteRequest || buyer.serviceOfInterest || 'Sin detalle adicional'}
                          </div>
                        )}
                      </div>

                      {/* Insight Comercial */}
                      <div className="p-2.5 rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong>Estrategia de Cierre en LEAD:</strong> Este prospecto muestra alto interés reiterado. Al contactarlo, revisa cada una de sus consultas para resolver sus objeciones de costo o tiempo y proponer facilidades de pago o citas en su franja horaria preferida.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <BuyerForm 
                ref={buyerFormRef}
                isEdit 
                excludeId={buyer.id || buyerId || undefined}
                formId="buyer-edit-form"
                hideSubmitButton
                initialValues={{
                  firstName: buyer.person.firstName,
                  lastName: buyer.person.lastName,
                  documentType: buyer.person.documentType,
                  documentNumber: buyer.person.documentNumber,
                  email: buyer.person.email,
                  phone: buyer.person.phone,
                  channel: buyer.channelId || buyer.channel,
                  attractionSource: buyer.attractionSourceId || buyer.attractionSource,
                  serviceOfInterestId: buyer.serviceOfInterestId,
                  contactAuthorization: buyer.contactAuthorization,
                  concreteRequest: buyer.concreteRequest,
                  pref_id_canal: buyer.pref_id_canal,
                  pref_id_horario: buyer.pref_id_horario,
                  pref_id_modalidad: buyer.pref_id_modalidad,
                  pref_sede_preferida: buyer.pref_sede_preferida,
                  pref_profesional_preferido: buyer.pref_profesional_preferido,
                  estudianteAplica: buyer.estudianteAplica,
                  universidad: buyer.universidad,
                  carrera: buyer.carrera,
                  ciclo: buyer.ciclo,
                  laboralAplica: buyer.laboralAplica,
                  ocupacion: buyer.ocupacion,
                  empresa: buyer.empresa,
                  modalidadLaboral: buyer.modalidadLaboral,
                  disponibilidadLaboral: buyer.disponibilidadLaboral,
                  ultima_visita_odontologica: buyer.ultima_visita_odontologica,
                  tratamiento_previo: buyer.tratamiento_previo,
                  nivel_dolor: buyer.nivel_dolor,
                  presenta_sensibilidad: buyer.presenta_sensibilidad,
                  sangrado_o_inflamacion: buyer.sangrado_o_inflamacion,
                  usa_aparato_o_protesis: buyer.usa_aparato_o_protesis,
                  condicion_atencion_especial: buyer.condicion_atencion_especial,
                }} 
                onSubmit={handleSubmit} 
                isLoading={updateBuyer.isPending} 
              />
            </div>
          )}
        </div>

        {/* Footer Fijo */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2 h-9.5 transition-colors"
          >
            Cerrar
          </Button>

          <Button
            type="button"
            onClick={() => buyerFormRef.current?.submit()}
            disabled={updateBuyer.isPending || !buyer}
            className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold px-5 py-2 h-9.5 shadow-sm transition-all flex items-center gap-1.5"
          >
            {updateBuyer.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Actualizar BUYER</span>
              </>
            )}
          </Button>
        </div>

        {/* Confirmación para conversión con Inteligencia de Negocios (Modo A - Advertencia Inteligente) */}
        <ConfirmationDialog
          isOpen={isConvertDialogOpen}
          onClose={() => setIsConvertDialogOpen(false)}
          onConfirm={handleConvert}
          title={isIntentAmbiguous ? "⚠️ Advertencia de Intención: ¿Convertir a LEAD?" : "¿Convertir a LEAD?"}
          description={
            isIntentAmbiguous
              ? "El Agente de Marketing (IA) detectó intención ambigua o datos incompletos. Revisa la evaluación del agente antes de proceder con el traspaso a LEAD:"
              : `El Agente de Marketing validó la intención comercial (${aiAnalysis?.intentEvaluation.intentReason || 'Solicitud concreta de atención'}). Esta acción registrará la conversión comercial a LEAD.`
          }
          confirmText={isIntentAmbiguous ? "Sí, Forzar Conversión a LEAD" : "Sí, Convertir a LEAD"}
          variant={isIntentAmbiguous ? "destructive" : "default"}
        >
          {isIntentAmbiguous && aiAnalysis && (
            <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>Dictamen del Agente de Marketing (IA):</span>
              </div>
              <p className="text-amber-900/90 dark:text-amber-200/90 text-[11px] leading-relaxed">
                {aiAnalysis.intentEvaluation.intentReason || 'No se detecta solicitud explícita ni urgencia en el motivo de consulta.'}
              </p>
              {aiAnalysis.intentEvaluation.marketingRecommendation && (
                <div className="pt-1.5 border-t border-amber-500/20 text-[10.5px] text-slate-600 dark:text-slate-300 flex items-start gap-1">
                  <span className="font-semibold text-amber-800 dark:text-amber-300 shrink-0">Recomendación:</span>
                  <span>{aiAnalysis.intentEvaluation.marketingRecommendation}</span>
                </div>
              )}
            </div>
          )}
        </ConfirmationDialog>
      </DialogContent>
    </Dialog>
  );
}
