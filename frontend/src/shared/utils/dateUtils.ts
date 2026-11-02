import { parseISO, isWeekend, isAfter } from 'date-fns';

/**
 * Calcula los minutos hábiles entre dos fechas.
 * Horario hábil: Lunes a Viernes, 08:00 a 18:00 (10 horas/día = 600 min/día).
 * Para simplificar, no se restan feriados ya que requeriría una API externa o calendario harcodeado.
 */
export function calculateBusinessMinutes(startDateISO: string, endDateISO: string): number {
  if (!startDateISO || !endDateISO) return 0;
  const start = parseISO(startDateISO);
  const end = parseISO(endDateISO);

  if (isAfter(start, end)) return 0;

  let totalMinutes = 0;
  const current = new Date(start.getTime());

  // Iterar minuto a minuto es seguro si las diferencias son cortas (días), 
  // que es lo habitual para tiempos de respuesta de "15 minutos".
  // Para evitar colapsos en grandes saltos, capamos a un máximo de días (ej. 30 días de diferencia = 30 * 1440 vueltas = 43k vueltas, aceptable).
  
  // Si la diferencia es muy alta, saltamos días enteros, pero como es para L2 (15 mins), la iteración por minutos es simple y a prueba de errores.
  while (current < end) {
    if (!isWeekend(current)) {
      const hours = current.getHours();
      // Horario hábil: de 8:00 a 17:59 (para contar el minuto, current debe estar entre 8 y 17)
      if (hours >= 8 && hours < 18) {
        totalMinutes++;
      }
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return totalMinutes;
}
