export interface OfficialDocxTemplate {
  code: string;
  title: string;
  category: 'KB-01' | 'KB-02' | 'KB-03' | 'KB-04' | 'KB-05';
  allowedRoles: Array<'PACIENTE' | 'ODONTOLOGO' | 'RECEPCION' | 'ADMIN'>;
  content: string;
}

export const OFFICIAL_KNOWLEDGE_DOCUMENTS: OfficialDocxTemplate[] = [
  {
    code: 'DOC-MINSA-01',
    title: 'Norma Técnica de Salud para la Gestión de la Historia Clínica Odontológica (NTS N° 139-MINSA)',
    category: 'KB-03',
    allowedRoles: ['ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Requisitos Obligatorios de Cierre Documental y Ficha Clínica

La Norma Técnica de Salud NTS N° 139-MINSA establece que toda atención odontológica culminada debe contar con registro completo de anamnesis, odontograma inicial, diagnóstico presuntivo o definitivo según CIE-10/CIE-11, procedimiento detallado y consentimiento informado.

Para el cierre documental formal de una atención clínica en NexoSalud, es mandatorio verificar:
1. Odontograma debidamente actualizado y fechado.
2. Procedimiento clínico detallado con técnica e insumos biomédicos empleados.
3. Validación del estado de antecedentes y ausencia de campos críticos pendientes.
4. Emisión de indicaciones postatención o plan de cuidados firmado por el odontólogo tratante.`
  },
  {
    code: 'DOC-MINSA-02',
    title: 'Guía de Práctica Clínica para la Prevención y Manejo de Infecciones Odontogénicas y Bioseguridad',
    category: 'KB-03',
    allowedRoles: ['ODONTOLOGO', 'ADMIN'],
    content: `# Protocolo de Bioseguridad, Esterilización y Prevención de Infecciones

El protocolo de bioseguridad institucional de NexoSalud y MINSA exige que todo instrumental quirúrgico, rotatorio y exploratorio sea procesado mediante autoclave clase B con controles biológicos semanales y monitoreo químico en cada ciclo.

Normas operativas:
1. Uso obligatorio de barreras de protección personal completas (guantes estériles, mascarilla quirúrgica o respirador N95, protección ocular y mandilón).
2. Desinfección rigurosa de superficies de la unidad dental entre paciente y paciente con amonio cuaternario o alcohol al 70%.
3. Manejo de desechos biocontaminados en recipientes rígidos con rotulado de riesgo biológico según norma DIGESA.`
  },
  {
    code: 'DOC-POST-01',
    title: 'Protocolo Clínico y Cuidados Postoperatorios de Exodoncia y Cirugía Oral',
    category: 'KB-01',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Cuidados Postoperatorios de Cirugía Oral y Extracción Dental

Tras un procedimiento de exodoncia o cirugía bucal, el paciente debe mantener una gasa estéril comprimiendo la zona operada durante 30 a 45 minutos continuos para favorecer la hemostasia y formación del coágulo primario.

Recomendaciones postoperatorias obligatorias en las primeras 24 a 48 horas:
1. No escupir, no enjuagarse la boca de manera vigorosa ni succionar con cañitas o sorbetes.
2. Mantener dieta blanda y fría o a temperatura ambiente (gelatinas, purés, yogur, helados).
3. Evitar comidas calientes, condimentos fuertes, grasas e irritantes.
4. Reposo relativo el día de la intervención; no realizar esfuerzos físicos intensos ni exponerse al sol.
5. Prohibido estrictamente fumar y consumir bebidas alcohólicas durante un mínimo de 48 horas para prevenir la alveolitis seca.`
  },
  {
    code: 'DOC-POST-02',
    title: 'Guía de Cuidados Postatención en Limpieza Dental, Profilaxis y Destartraje',
    category: 'KB-01',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Cuidados Postatención tras Limpieza Dental y Profilaxis

Posterior al destartraje supragingival con ultrasonido y pulido coronario con aplicación de flúor barniz o gel:
1. No ingerir alimentos sólidos ni bebidas calientes durante las 2 primeras horas para permitir la fijación del flúor en el esmalte.
2. Puede presentarse leve sensibilidad transitoria en el cuello dental al frío o calor durante 24 a 72 horas, lo cual es normal y cede paulatinamente.
3. Higiene bucal con cepillo de cerdas suaves y técnica de cepillado suave (Bass modificada); no omitir el cepillado ni el hilo dental.
4. Evitar alimentos o bebidas altamente pigmentantes (café oscuro, té negro, vino tinto, gaseosas oscuras y salsas rojas) durante las primeras 24 horas.`
  },
  {
    code: 'DOC-POST-03',
    title: 'Pautas de Adaptación y Cuidados en Tratamiento de Ortodoncia con Brackets',
    category: 'KB-01',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Recomendaciones para Pacientes con Brackets y Aparatología Fija

Durante el tratamiento de ortodoncia, el cuidado diario previene el desprendimiento de aditamentos y caries interdentales:
1. Alimentos prohibidos: dulces duros, caramelos pegajosos, turrones, frutos secos enteros, chicles y morder hielo.
2. Alimentos que deben cortarse en trozos pequeños antes de comer: manzanas, carnes, panes duros o tostadas.
3. Higiene bucodental: uso obligatorio de cepillo ortodóntico y cepillos interproximales después de cada comida.
4. En caso de roce o llaga inicial en labios o mejillas, aplicar cera ortodóntica de alivio sobre el bracket o arco causante.`
  },
  {
    code: 'DOC-POST-04',
    title: 'Protocolo de Urgencias Odontológicas y Manejo Inmediato del Dolor',
    category: 'KB-01',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Guía de Manejo Inmediato ante Urgencias Odontológicas

En situaciones de dolor agudo, inflamación o traumatismo bucodental:
1. Traumatismo con caída del diente (avulsión): No frotar ni raspar la raíz. Tomar la pieza por la corona y colocarla de inmediato en leche fresca, solución fisiológica o saliva. Acudir a la clínica dental antes de los 60 minutos para maximizar la posibilidad de reimplante.
2. Dolor dental intenso o punzante: No colocar pastillas o analgésicos directamente sobre la encía o el diente (causan quemaduras químicas). Comunicarse de inmediato a la central de urgencias de NexoSalud.
3. Inflamación facial o sangrado continuo: Aplicar frío local externo con compresas limpias y acudir a evaluación prioritaria.`
  },
  {
    code: 'DOC-POL-01',
    title: 'Política Institucional de Gestión y Reprogramación de Citas de NexoSalud',
    category: 'KB-02',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Política Institucional de Citas y Reprogramación

Para garantizar la continuidad del tratamiento y el respeto a la agenda médica:
1. Toda solicitud de reprogramación debe presentarse con una anticipación mínima de 24 horas a través del portal de salud o central de atención.
2. La solicitud registrada en el portal mantiene vigente la cita original hasta que el equipo de recepción revise la disponibilidad de agenda y confirme el nuevo horario.
3. Cada paciente cuenta con hasta 2 reprogramaciones por tratamiento sin penalidad administrativa. En inasistencias sin aviso previo (no show), se genera una alerta asistencial para contactar al paciente y reprogramar su sesión.`
  },
  {
    code: 'DOC-POL-02',
    title: 'Reglas de Transición Asistencial del Funnel: CUSTOMER a TURNED',
    category: 'KB-05',
    allowedRoles: ['ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Criterios Institucionales para la Transición de Etapa de CUSTOMER a TURNED

En el embudo asistencial de NexoSalud, la fase CUSTOMER abarca a todo paciente con tratamiento contratado activo.

Criterios objetivos para la transición oficial a la fase TURNED (Alta Clínica / Fin de Tratamiento):
1. Cumplimiento del 100% de las sesiones planificadas del plan de tratamiento contratado.
2. Cierre documental completado con estado validado en todas las atenciones ejecutadas.
3. Aprobación y firma médica del alta clínica por parte del odontólogo responsable.
4. Programación del control preventivo semestral o anual de mantenimiento.`
  },
  {
    code: 'DOC-POL-03',
    title: 'Directiva de Sedes, Horarios de Atención y Cobertura Asistencial',
    category: 'KB-05',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Sedes Clínicas y Canales de Atención NexoSalud

NexoSalud brinda atención odontológica especializada en sus sedes de Trujillo:
1. Sede California: Av. Larco 850, Trujillo. Atención de lunes a sábado de 08:00 a 20:00 horas.
2. Sede Mansiche: Av. Mansiche 412, Trujillo. Atención de lunes a viernes de 08:00 a 19:00 horas, sábados de 08:00 a 14:00 horas.
3. Canales oficiales: Portal de Salud Web NexoSalud, Central telefónica (044) 284-910 y canal de WhatsApp asistencial.`
  },
  {
    code: 'DOC-POL-04',
    title: 'Política de Privacidad, Protección de Datos Médicos y Confidencialidad',
    category: 'KB-05',
    allowedRoles: ['PACIENTE', 'ODONTOLOGO', 'RECEPCION', 'ADMIN'],
    content: `# Confidencialidad y Protección de Datos Personales en Salud

En cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales del Perú) y directivas sanitarias:
1. La información clínica, odontogramas y diagnósticos son de carácter estrictamente confidencial.
2. Los modelos de Inteligencia Artificial de NexoSalud actúan como asistentes documentales y procesan consultas de forma anonimizada o restringida al ámbito de la sesión autenticada.
3. Se prohíbe terminantemente la divulgación o transferencia de historiales clínicos a personas no autorizadas.`
  }
];
