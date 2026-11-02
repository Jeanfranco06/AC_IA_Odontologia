export interface ReasonChipOption {
  id: 'ortodoncia' | 'estetica' | 'implante' | 'limpieza_dolor';
  label: string;
  subtitle: string;
  /** Palabras clave para enlazar automáticamente con `catalogs.servicios`. */
  keywords: string[];
}

export const REASON_CHIPS: ReasonChipOption[] = [
  {
    id: 'ortodoncia',
    label: 'Ortodoncia',
    subtitle: 'Alineadores invisibles y brackets',
    keywords: ['ortodoncia', 'bracket', 'alineador', 'invisible'],
  },
  {
    id: 'estetica',
    label: 'Estética',
    subtitle: 'Carillas, diseño y aclaramiento',
    keywords: ['estética', 'estetica', 'carilla', 'blanqueamiento', 'aclaramiento', 'diseño', 'restauración'],
  },
  {
    id: 'implante',
    label: 'Implante',
    subtitle: 'Titanio guiado 3D y rehabilitación',
    keywords: ['implante', 'prótesis', 'protesis', 'rehabilitación', 'corona'],
  },
  {
    id: 'limpieza_dolor',
    label: 'Limpieza / Dolor',
    subtitle: 'Profilaxis ultrasónica o urgencia',
    keywords: ['limpieza', 'profilaxis', 'consulta', 'endodoncia', 'dolor', 'general', 'evaluación'],
  },
];

export interface TimeSlotChip {
  id: '1' | '2' | '3';
  label: 'Mañana' | 'Tarde' | 'Noche';
  hours: string;
  fullLabel: string;
}

export const TIME_SLOT_CHIPS: TimeSlotChip[] = [
  {
    id: '1',
    label: 'Mañana',
    hours: '08:00 – 13:00',
    fullLabel: 'Turno Mañana (08:00 AM – 01:00 PM)',
  },
  {
    id: '2',
    label: 'Tarde',
    hours: '13:00 – 18:00',
    fullLabel: 'Turno Tarde (01:00 PM – 06:00 PM)',
  },
  {
    id: '3',
    label: 'Noche',
    hours: '18:00 – 21:00',
    fullLabel: 'Turno Noche (06:00 PM – 09:00 PM)',
  },
];

export interface TechSpecialtyItem {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  metrics: string;
  highlights: string[];
  reasonId: ReasonChipOption['id'];
}

export const TECH_SPECIALTIES: TechSpecialtyItem[] = [
  {
    id: 'scanner-3d',
    tag: 'Diagnóstico Digital',
    title: 'Escáner Intraoral 3D',
    subtitle: 'Impresiones ópticas de alta precisión sin pastas ni molestias',
    description:
      'Capturamos 6,000 imágenes por segundo para reconstruir una réplica tridimensional exacta de tu dentadura en menos de 90 segundos, permitiendo simular tu resultado antes de iniciar.',
    metrics: 'Precisión de 20 micras · 0% náuseas',
    highlights: [
      'Simulación clínica inmediata en pantalla',
      'Ajuste milimétrico en coronas, carillas y alineadores',
      'Archivo digital permanente en tu historia clínica',
    ],
    reasonId: 'estetica',
  },
  {
    id: 'panoramica-cbct',
    tag: 'Imagenología de Baja Dosis',
    title: 'Radiografía Panorámica y Tomografía 3D',
    subtitle: 'Planificación quirúrgica guiada en una sola visita',
    description:
      'Visualizamos estructuras óseas, raíces y trayectorias nerviosas con hasta un 85% menos radiación que los equipos convencionales, eliminando traslados a centros externos.',
    metrics: '-85% dosis de radiación · Entrega en 3 min',
    highlights: [
      'Cirugía de implantes guiada por computadora',
      'Detección temprana de lesiones subgingivales',
      'Evaluación integral de terceros molares y ATM',
    ],
    reasonId: 'implante',
  },
  {
    id: 'ortodoncia-invisible',
    tag: 'Biomecánica Predictiva',
    title: 'Ortodoncia Invisible y Estética',
    subtitle: 'Alineación progresiva con polímeros médicos transparentes',
    description:
      'Planificamos cada movimiento dental por computadora etapa por etapa. Alineadores removibles, prácticamente imperceptibles y compatibles con tu ritmo profesional.',
    metrics: 'Controles cada 6–8 semanas · Sin urgencias por alambres',
    highlights: [
      'Higiene bucal sin restricciones al comer o cepillarte',
      'Previsualización 3D del tiempo exacto de tratamiento',
      'Opciones en zafiro estético y autoligado pasivo',
    ],
    reasonId: 'ortodoncia',
  },
];

export interface ClinicalTreatmentItem {
  id: string;
  title: string;
  duration: string;
  summary: string;
  reasonId: ReasonChipOption['id'];
}

export const CLINICAL_TREATMENTS: ClinicalTreatmentItem[] = [
  {
    id: 'rehabilitacion-implantes',
    title: 'Implantes de Carga Planificada',
    duration: 'Sesión quirúrgica de 45 min',
    summary: 'Reposición fija con implantes de titanio grado médico y guías quirúrgicas impresas en 3D.',
    reasonId: 'implante',
  },
  {
    id: 'diseno-sonrisa',
    title: 'Estética Dental & Carillas de Porcelana',
    duration: '2 a 3 sesiones clínicas',
    summary: 'Laminados feldespáticos y disilicato de litio diseñados según tu proporción facial y tono natural.',
    reasonId: 'estetica',
  },
  {
    id: 'ortodoncia-digital',
    title: 'Ortodoncia Digital & Alineadores',
    duration: 'Evaluación inicial de 40 min',
    summary: 'Corrección de mordida y alineación dental mediante planificación cefalométrica computarizada.',
    reasonId: 'ortodoncia',
  },
  {
    id: 'prevencion-urgencias',
    title: 'Profilaxis Ultrasónica & Alivio del Dolor',
    duration: 'Atención prioritaria en el día',
    summary: 'Higiene clínica con ultrasonido piezoeléctrico, flujo guiado de biofilm y manejo indoloro de urgencias.',
    reasonId: 'limpieza_dolor',
  },
];

export interface ClinicLocation {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  city: string;
  phone: string;
  scheduleWeekdays: string;
  scheduleSaturday: string;
  parkingInfo: string;
  specialtiesBadge: string;
  mapsQuery: string;
}

export const CLINIC_LOCATIONS: ClinicLocation[] = [
  {
    id: 'california',
    name: 'Sede California',
    neighborhood: 'Víctor Larco Herrera · Trujillo',
    address: 'Av. Fátima 125, Urb. California, Víctor Larco Herrera',
    city: 'Trujillo 13009',
    phone: '(044) 612-840',
    scheduleWeekdays: 'Lun – Vie: 08:00 a 21:00',
    scheduleSaturday: 'Sáb: 08:00 a 18:00',
    parkingInfo: 'Estacionamiento privado para pacientes y acceso sin escalones',
    specialtiesBadge: 'Centro Quirúrgico & Tomografía 3D',
    mapsQuery: 'Av.+Fatima+125+Urb+California+Trujillo+Peru',
  },
  {
    id: 'el-golf',
    name: 'Sede El Golf',
    neighborhood: 'Urb. El Golf · Trujillo',
    address: 'Av. El Golf 680, Víctor Larco Herrera',
    city: 'Trujillo 13009',
    phone: '(044) 612-845',
    scheduleWeekdays: 'Lun – Vie: 08:00 a 21:00',
    scheduleSaturday: 'Sáb: 08:00 a 18:00',
    parkingInfo: 'Zona de parqueo frontal vigilado y suites de diseño de sonrisa',
    specialtiesBadge: 'Ortodoncia Digital & Estética',
    mapsQuery: 'Av.+El+Golf+680+Victor+Larco+Herrera+Trujillo+Peru',
  },
  {
    id: 'centro',
    name: 'Sede Centro Historico',
    neighborhood: 'Centro Histórico · Trujillo',
    address: 'Jr. Independencia 450, a 1 cuadra de la Plaza Mayor',
    city: 'Trujillo 13001',
    phone: '(044) 612-850',
    scheduleWeekdays: 'Lun – Vie: 08:00 a 20:30',
    scheduleSaturday: 'Sáb: 08:30 a 17:30',
    parkingInfo: 'Convenio con cochera contigua (1ra hora cubierta)',
    specialtiesBadge: 'Diagnóstico Express & Rehabilitación',
    mapsQuery: 'Jr.+Independencia+450+Centro+Historico+Trujillo+Peru',
  },
];

/** Normaliza el nombre de una sede quitando tildes y espacios extra para comparaciones seguras */
export function normalizeBranchKey(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Fusiona las sedes provenientes de `catalogs.sedes` (Base de Datos) con los metadatos
 * enriquecidos de `CLINIC_LOCATIONS`, garantizando que el `name` sea idéntico al del formulario.
 */
export function resolveClinicLocations(catalogSedes?: any[]): ClinicLocation[] {
  if (!catalogSedes || catalogSedes.length === 0) {
    return CLINIC_LOCATIONS;
  }

  return catalogSedes.map((sedeDb: any, idx: number) => {
    const dbName = String(sedeDb.nombre || '').trim();
    const key = normalizeBranchKey(dbName);

    const matchedPreset =
      CLINIC_LOCATIONS.find((loc) => normalizeBranchKey(loc.name) === key) ||
      (key.includes('california')
        ? CLINIC_LOCATIONS[0]
        : key.includes('golf') || key.includes('primavera')
          ? CLINIC_LOCATIONS[1]
          : key.includes('centro')
            ? CLINIC_LOCATIONS[2]
            : CLINIC_LOCATIONS[idx % CLINIC_LOCATIONS.length]);

    const address = sedeDb.direccion || matchedPreset.address;
    const neighborhood = sedeDb.zona ? `${sedeDb.zona} · Trujillo` : matchedPreset.neighborhood;

    return {
      ...matchedPreset,
      id: String(sedeDb.id_sede ?? matchedPreset.id ?? idx),
      name: dbName,
      address,
      neighborhood,
      mapsQuery: encodeURIComponent(`${address}, Trujillo, Peru`),
    };
  });
}

export interface AccreditationBadge {
  code: string;
  title: string;
  institution: string;
  detail: string;
}

export const ACCREDITATION_BADGES: AccreditationBadge[] = [
  {
    code: 'COP · RNE',
    title: 'Especialistas Colegiados y Habilitados',
    institution: 'Colegio Odontológico del Perú',
    detail: '100% del staff cuenta con Registro Nacional de Especialista (RNE) vigente.',
  },
  {
    code: 'ISO 13485 · CLASE B',
    title: 'Bioseguridad y Esterilización Trazable',
    institution: 'Autoclaves de vacío fraccionado',
    detail: 'Instrumental sellado con indicadores químicos y biológicos verificados por paciente.',
  },
  {
    code: 'SUSALUD · MINSA',
    title: 'IPRESS Categorizada y Supervisada',
    institution: 'Registro Nacional de IPRESS',
    detail: 'Infraestructura clínica auditada bajo normas técnicas de salud odontológica.',
  },
  {
    code: 'LEY N° 29733',
    title: 'Historia Clínica Digital Protegida',
    institution: 'Protección de Datos Personales',
    detail: 'Resguardo cifrado de radiografías, odontogramas y consentimientos informados.',
  },
];

export interface PatientTestimonial {
  name: string;
  treatment: string;
  branch: string;
  quote: string;
  rating: number;
  verifiedDate: string;
}

export const PATIENT_TESTIMONIALS: PatientTestimonial[] = [
  {
    name: 'Mariana Villavicencio R.',
    treatment: 'Ortodoncia con alineadores + escaneo 3D',
    branch: 'Sede California',
    quote:
      'Desde la primera cita vi en pantalla cómo iba a quedar mi sonrisa sin pasar por los moldes de pasta. Los horarios se respetan al minuto y el seguimiento por WhatsApp es impecable.',
    rating: 5,
    verifiedDate: 'Octubre 2026',
  },
  {
    name: 'Dr. Carlos Ibáñez Montoya',
    treatment: 'Implante dental guiado por tomografía',
    branch: 'Sede California',
    quote:
      'Como médico valoro enormemente el rigor en bioseguridad. Me realizaron la tomografía en la misma clínica y la cirugía fue rápida, limpia y prácticamente sin inflamación postoperatoria.',
    rating: 5,
    verifiedDate: 'Septiembre 2026',
  },
  {
    name: 'Claudia Paredes Alcántara',
    treatment: 'Diseño de sonrisa en porcelana',
    branch: 'Sede El Golf',
    quote:
      'Buscaba un resultado natural, nada artificial. El especialista dedicó toda la primera sesión a escucharme y hacer una prueba estética antes de tocar mis dientes.',
    rating: 5,
    verifiedDate: 'Septiembre 2026',
  },
];
