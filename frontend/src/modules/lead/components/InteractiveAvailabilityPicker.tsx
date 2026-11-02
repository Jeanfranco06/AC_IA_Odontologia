import React, { useState, useMemo } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  addDays,
  isBefore,
  startOfDay,
  getDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Sparkles,
  PlusCircle,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

export interface PatientPreferences {
  sede?: string;
  profesional?: string;
  horarioId?: string;
  horarioNombre?: string;
  horario?: {
    dia_semana?: number;
    hora_inicio?: string;
    hora_fin?: string;
  };
}

export interface InteractiveAvailabilityPickerProps {
  disponibilidades: any[];
  profesionales: any[];
  sedes: any[];
  selectedProfesionalId: string;
  selectedSedeId: string;
  selectedDate: string; // YYYY-MM-DD
  selectedDisponibilidadId: string;
  customTime?: { startTime: string; endTime: string };
  isCustomMode?: boolean;
  patientPreferences?: PatientPreferences;
  onSelectDate: (dateStr: string) => void;
  onSelectDisponibilidad: (dispId: string, dispObj?: any) => void;
  onCustomTimeChange?: (custom: { startTime: string; endTime: string }) => void;
  onToggleCustomMode?: (isCustom: boolean) => void;
  errorMessage?: string;
}

const PRESET_HOURS = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
  { start: '19:00', end: '20:00' },
];

// Helper para calcular nivel de Match y coincidencias (Horario, Sede, Especialista)
function calculateSlotMatch(disp: any, dateStr: string, prefs?: PatientPreferences) {
  if (!prefs) {
    return {
      matchCount: 0,
      matchesDoctor: false,
      matchesSede: false,
      matchesHorario: false,
    };
  }

  // 1. Especialista
  const profApellidos = disp.Profesional?.apellidos || '';
  const profNombres = disp.Profesional?.nombres || '';
  const profFullName = `${profNombres} ${profApellidos}`.trim().toLowerCase();
  const targetProf = (prefs.profesional || '').trim().toLowerCase();
  const matchesDoctor = Boolean(
    targetProf &&
    (profFullName.includes(targetProf) ||
     targetProf.includes(profApellidos.toLowerCase()) ||
     targetProf.includes(profNombres.toLowerCase()))
  );

  // 2. Sede
  const sedeNombre = (disp.Sede?.nombre || '').trim().toLowerCase();
  const targetSede = (prefs.sede || '').trim().toLowerCase();
  const matchesSede = Boolean(
    targetSede &&
    (sedeNombre.includes(targetSede) || targetSede.includes(sedeNombre))
  );

  // 3. Horario
  let matchesHorario = false;
  const slotStart = typeof disp.hora_inicio === 'string'
    ? (disp.hora_inicio.includes('T') ? disp.hora_inicio.substring(11, 16) : disp.hora_inicio.substring(0, 5))
    : '';

  if (prefs.horario) {
    let dayMatches = true;
    if (typeof prefs.horario.dia_semana === 'number' && dateStr) {
      try {
        const slotDayOfWeek = getDay(parseISO(dateStr));
        dayMatches = slotDayOfWeek === prefs.horario.dia_semana;
      } catch {}
    }

    let timeMatches = false;
    if (slotStart && prefs.horario.hora_inicio && prefs.horario.hora_fin) {
      timeMatches = slotStart >= prefs.horario.hora_inicio && slotStart <= prefs.horario.hora_fin;
    } else if (slotStart && prefs.horario.hora_inicio) {
      timeMatches = slotStart === prefs.horario.hora_inicio;
    }

    matchesHorario = (dayMatches && timeMatches) || timeMatches;
  } else if (prefs.horarioNombre && slotStart) {
    matchesHorario = prefs.horarioNombre.includes(slotStart);
  }

  let matchCount = 0;
  if (matchesDoctor) matchCount++;
  if (matchesSede) matchCount++;
  if (matchesHorario) matchCount++;

  return {
    matchCount,
    matchesDoctor,
    matchesSede,
    matchesHorario,
  };
}

export function InteractiveAvailabilityPicker({
  disponibilidades = [],
  profesionales = [],
  sedes = [],
  selectedProfesionalId,
  selectedSedeId,
  selectedDate,
  selectedDisponibilidadId,
  customTime = { startTime: '09:00', endTime: '10:00' },
  isCustomMode = false,
  patientPreferences,
  onSelectDate,
  onSelectDisponibilidad,
  onCustomTimeChange,
  onToggleCustomMode,
  errorMessage,
}: InteractiveAvailabilityPickerProps) {
  // Política estricta de anticipación mínima de 3 días (72 horas)
  const minAllowedDate = useMemo(() => addDays(startOfDay(new Date()), 3), []);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) {
      try {
        const parsed = parseISO(selectedDate);
        if (!isBefore(startOfDay(parsed), minAllowedDate)) {
          return parsed;
        }
      } catch (e) {}
    }
    return minAllowedDate;
  });

  const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>(isCustomMode ? 'custom' : 'catalog');
  const [matchFilter, setMatchFilter] = useState<'ALL' | '3' | '2' | '1'>('ALL');

  // Mapa de fechas que tienen turnos disponibles en el catálogo (filtrado de horarios de atención válidos)
  const datesWithSlotsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of disponibilidades) {
      if (selectedProfesionalId && d.id_profesional?.toString() !== selectedProfesionalId) continue;
      if (selectedSedeId && d.id_sede?.toString() !== selectedSedeId) continue;
      
      const dateKey = (d.fecha || '').split('T')[0];
      if (!dateKey) continue;

      // Filtrar días anteriores a la política de 72 horas
      try {
        if (isBefore(startOfDay(parseISO(dateKey)), minAllowedDate)) continue;
      } catch {}

      // Filtrar horarios de madrugada no laborables (ej. 00:00 a 06:00)
      const rawStart = typeof d.hora_inicio === 'string' 
        ? (d.hora_inicio.includes('T') ? d.hora_inicio.substring(11, 16) : d.hora_inicio.substring(0, 5)) 
        : '';
      if (rawStart) {
        const hourNum = parseInt(rawStart.split(':')[0], 10);
        if (hourNum < 7 || hourNum > 22) continue;
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(d);
    }
    return map;
  }, [disponibilidades, selectedProfesionalId, selectedSedeId, minAllowedDate]);

  // Días para renderizar la cuadrícula del mes
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  // Turnos disponibles únicos y ordenados por nivel de Match descendente y luego por hora
  const allSlotsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const rawSlots = datesWithSlotsMap.get(selectedDate) || [];
    
    const uniqueMap = new Map<string, any>();
    for (const slot of rawSlots) {
      const hInicio = typeof slot.hora_inicio === 'string' 
        ? (slot.hora_inicio.includes('T') ? slot.hora_inicio.substring(11, 16) : slot.hora_inicio.substring(0, 5))
        : '09:00';
      const hFin = typeof slot.hora_fin === 'string' 
        ? (slot.hora_fin.includes('T') ? slot.hora_fin.substring(11, 16) : slot.hora_fin.substring(0, 5))
        : '10:00';
      
      const key = `${hInicio}_${hFin}_${slot.id_profesional}_${slot.id_sede}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, slot);
      }
    }

    const listWithMatches = Array.from(uniqueMap.values()).map(slot => ({
      ...slot,
      matchInfo: calculateSlotMatch(slot, selectedDate, patientPreferences),
    }));

    return listWithMatches.sort((a, b) => {
      // Prioridad 1: Mayor nivel de coincidencia (3 -> 2 -> 1 -> 0)
      if (b.matchInfo.matchCount !== a.matchInfo.matchCount) {
        return b.matchInfo.matchCount - a.matchInfo.matchCount;
      }
      // Prioridad 2: Orden cronológico de hora de inicio
      const tA = String(a.hora_inicio || '');
      const tB = String(b.hora_inicio || '');
      return tA.localeCompare(tB);
    });
  }, [datesWithSlotsMap, selectedDate, patientPreferences]);

  // Conteo de turnos según coincidencias para los filtros
  const matchCounts = useMemo(() => {
    const counts = { total: 0, 3: 0, 2: 0, 1: 0, 0: 0 };
    for (const slot of allSlotsForSelectedDate) {
      counts.total++;
      const c = slot.matchInfo.matchCount as 0 | 1 | 2 | 3;
      if (counts[c] !== undefined) counts[c]++;
    }
    return counts;
  }, [allSlotsForSelectedDate]);

  // Turnos filtrados según el filtro de coincidencias seleccionado
  const availableSlotsForSelectedDate = useMemo(() => {
    if (matchFilter === 'ALL') return allSlotsForSelectedDate;
    const num = parseInt(matchFilter, 10);
    return allSlotsForSelectedDate.filter(s => s.matchInfo.matchCount === num);
  }, [allSlotsForSelectedDate, matchFilter]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleSelectMinDate = () => {
    setCurrentMonth(minAllowedDate);
    const dateStr = format(minAllowedDate, 'yyyy-MM-dd');
    onSelectDate(dateStr);
  };

  const handleDayClick = (day: Date) => {
    if (isBefore(startOfDay(day), minAllowedDate)) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    onSelectDate(dateStr);
  };

  const handleTabSwitch = (tab: 'catalog' | 'custom') => {
    setActiveTab(tab);
    if (onToggleCustomMode) {
      onToggleCustomMode(tab === 'custom');
    }
  };

  return (
    <div className="space-y-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-4">
      {/* Cabecera del Módulo de Horarios */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Horario y Disponibilidad en Mesa
              </h4>
              <Badge variant="outline" className="bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-[10px] py-0 px-1.5 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                Mín. 72h Margen
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Selecciona una fecha válida (mínimo 3 días de anticipación para política de cobranza).
            </p>
          </div>
        </div>

        {/* Selector de Modo: Catálogo vs Personalizado */}
        <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch('catalog')}
            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1.5 ${
              activeTab === 'catalog'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            Turnos en Agenda
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('custom')}
            className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all flex items-center gap-1.5 ${
              activeTab === 'custom'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            Horario Personalizado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* COLUMNA 1: Mini Calendario Interactivo */}
        <div className="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header del Calendario: Mes y Controles */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="h-6 w-6 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Mes anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <button
                  type="button"
                  onClick={handleSelectMinDate}
                  className="h-6 text-[10px] px-2 rounded-lg font-bold border border-teal-300 dark:border-teal-700/70 bg-teal-50 dark:bg-slate-700/90 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-slate-600 transition-colors shadow-xs flex items-center gap-1"
                  title="Seleccionar el primer día hábil con 72h de anticipación"
                >
                  <span>Mín. 72h</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                  className="h-6 w-6 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Mes siguiente"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Días de la semana */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">
              <span>Lu</span>
              <span>Ma</span>
              <span>Mi</span>
              <span>Ju</span>
              <span>Vi</span>
              <span>Sá</span>
              <span>Do</span>
            </div>

            {/* Cuadrícula de días */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const isSelected = selectedDate === dayKey;
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const hasSlots = (datesWithSlotsMap.get(dayKey) || []).length > 0;
                const isTodayDate = isToday(day);
                const isDayDisabled = isBefore(startOfDay(day), minAllowedDate);

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isDayDisabled}
                    onClick={() => handleDayClick(day)}
                    title={isDayDisabled ? "Bloqueado: Requiere 3 días de margen mínimo (política de cobranza 72h)" : undefined}
                    className={`relative h-8 w-full rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                      isDayDisabled
                        ? 'opacity-30 cursor-not-allowed bg-slate-100/50 dark:bg-slate-800/20 text-slate-400 dark:text-slate-600 line-through select-none'
                        : isSelected
                        ? 'bg-teal-600 text-white shadow-sm font-bold scale-105 z-10'
                        : isTodayDate
                        ? 'ring-1 ring-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50/50 dark:bg-teal-950/40 hover:bg-teal-100'
                        : !isCurrentMonth
                        ? 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                        : hasSlots
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/80 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{format(day, 'd')}</span>

                    {/* Indicador de turnos disponibles */}
                    {!isDayDisabled && hasSlots && !isSelected && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-500" />
                    )}
                    {!isDayDisabled && hasSlots && isSelected && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leyenda del Calendario */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 flex-wrap gap-1">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
              Con cupos
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-teal-600 inline-block" />
              Seleccionado
            </span>
            <span className="flex items-center gap-1 line-through text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
              &lt;72h Bloqueado
            </span>
          </div>
        </div>

        {/* COLUMNA 2: Horarios / Bloques de Horas Disponibles */}
        <div className="space-y-2.5 flex flex-col justify-between">
          {activeTab === 'catalog' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  {selectedDate ? (
                    <>
                      Turnos para: <span className="text-teal-700 dark:text-teal-300 capitalize">{format(parseISO(selectedDate), "EEEE dd 'de' MMMM", { locale: es })}</span>
                    </>
                  ) : (
                    'Selecciona un día en el calendario'
                  )}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {allSlotsForSelectedDate.length} {allSlotsForSelectedDate.length === 1 ? 'turno disponible' : 'turnos disponibles'}
                </span>
              </div>

              {/* Barra de Filtros por Nivel de Coincidencias */}
              {allSlotsForSelectedDate.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1 mr-0.5">
                    Coincidencias:
                  </span>
                  <button
                    type="button"
                    onClick={() => setMatchFilter('ALL')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      matchFilter === 'ALL'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Todos ({matchCounts.total})
                  </button>
                  {matchCounts[3] > 0 && (
                    <button
                      type="button"
                      onClick={() => setMatchFilter('3')}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        matchFilter === '3'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                      3/3 ({matchCounts[3]})
                    </button>
                  )}
                  {matchCounts[2] > 0 && (
                    <button
                      type="button"
                      onClick={() => setMatchFilter('2')}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                        matchFilter === '2'
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700 hover:bg-teal-100'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      2/3 ({matchCounts[2]})
                    </button>
                  )}
                  {matchCounts[1] > 0 && (
                    <button
                      type="button"
                      onClick={() => setMatchFilter('1')}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                        matchFilter === '1'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      1/3 ({matchCounts[1]})
                    </button>
                  )}
                </div>
              )}

              {/* Lista / Grid de Turnos */}
              {!selectedDate ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/40">
                  <CalendarIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Selecciona una fecha</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Haz clic en cualquier día habilitado del calendario para ver los horarios.</p>
                </div>
              ) : availableSlotsForSelectedDate.length === 0 ? (
                <div className="p-6 text-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/40 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {allSlotsForSelectedDate.length > 0 
                      ? 'No hay turnos con el nivel de coincidencia seleccionado.'
                      : 'No hay turnos registrados en agenda para esta fecha.'}
                  </p>
                  {allSlotsForSelectedDate.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setMatchFilter('ALL')}
                      className="text-xs rounded-xl h-8"
                    >
                      Ver todos los turnos disponibles
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleTabSwitch('custom')}
                      className="text-xs rounded-xl h-8 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-50"
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1 text-teal-600" />
                      Proponer Horario para este día
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto no-scrollbar p-0.5">
                  {availableSlotsForSelectedDate.map((disp: any) => {
                    const isSelected = selectedDisponibilidadId === disp.id_disponibilidad.toString();
                    const horaInicio = String(disp.hora_inicio || '').substring(11, 16) || '09:00';
                    const horaFin = String(disp.hora_fin || '').substring(11, 16) || '10:00';
                    const profApellidos = disp.Profesional?.apellidos || 'General';
                    const profNombres = disp.Profesional?.nombres || '';
                    const sedeNombre = disp.Sede?.nombre ? `${disp.Sede.nombre}${disp.Sede.direccion ? ` - ${disp.Sede.direccion}` : ''}` : 'Sede';
                    const { matchCount, matchesDoctor, matchesSede, matchesHorario } = disp.matchInfo;

                    return (
                      <div
                        key={disp.id_disponibilidad}
                        onClick={() => onSelectDisponibilidad(disp.id_disponibilidad.toString(), disp)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between gap-2 text-left relative ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-600 dark:border-teal-500 shadow-md ring-2 ring-teal-500/20'
                            : matchCount === 3
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400/80 dark:border-emerald-600/70 hover:border-emerald-500 hover:shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-600'
                        }`}
                      >
                        {/* Fila Superior: Hora y Pill simple N/3 */}
                        <div className="flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-700/80 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            {matchesHorario ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Clock className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'} shrink-0`} />
                            )}
                            <span className={`text-xs font-bold ${isSelected ? 'text-teal-900 dark:text-teal-100' : 'text-slate-900 dark:text-white'}`}>
                              {horaInicio} – {horaFin}
                            </span>
                          </div>

                          {/* Badge limpio N/3 sin palabra MATCH ni check extra */}
                          {matchCount === 3 && (
                            <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-xs">
                              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              3/3
                            </span>
                          )}
                          {matchCount === 2 && (
                            <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/80 border border-teal-300 dark:border-teal-700 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                              2/3
                            </span>
                          )}
                          {matchCount === 1 && (
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                              1/3
                            </span>
                          )}
                        </div>

                        {/* Fila Intermedia: Especialista y Sede con check directo en el icono */}
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            {matchesDoctor ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className={`truncate font-medium ${matchesDoctor ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                              Esp. {profNombres} {profApellidos}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 truncate">
                            {matchesSede ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className={`truncate ${matchesSede ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                              {sedeNombre}
                            </span>
                          </div>
                        </div>

                        {/* Checkmark al seleccionar */}
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center shadow-md">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {errorMessage && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold pt-1">
                  {errorMessage}
                </p>
              )}
            </div>
          ) : (
            /* TAB 2: Horario Personalizado (Chips Rápidos de Horas) */
            <div className="space-y-3 bg-white dark:bg-slate-800/90 p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Elegir Bloque Horario Rápido
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                  {selectedDate ? format(parseISO(selectedDate), "EEEE dd 'de' MMMM", { locale: es }) : 'Elige una fecha'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {PRESET_HOURS.map((preset, i) => {
                  const isPresetActive = customTime.startTime === preset.start && customTime.endTime === preset.end;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (onCustomTimeChange) {
                          onCustomTimeChange({ startTime: preset.start, endTime: preset.end });
                        }
                      }}
                      className={`p-2 rounded-xl text-center border text-xs font-semibold transition-all ${
                        isPresetActive
                          ? 'bg-teal-600 text-white border-teal-600 shadow-sm font-bold scale-105'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:border-teal-300'
                      }`}
                    >
                      {preset.start} - {preset.end}
                    </button>
                  );
                })}
              </div>

              {/* Inputs precisos de hora */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Hora Inicio</label>
                  <input
                    type="time"
                    value={customTime.startTime}
                    onChange={(e) => onCustomTimeChange?.({ ...customTime, startTime: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Hora Fin</label>
                  <input
                    type="time"
                    value={customTime.endTime}
                    onChange={(e) => onCustomTimeChange?.({ ...customTime, endTime: e.target.value })}
                    className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
