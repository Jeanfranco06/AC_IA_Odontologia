# Plantillas de indicaciones IA10

Se registraron 12 propuestas en NexoSaludDB el 12 de noviembre de 2026, para los servicios activos. Su estado inicial es Borrador; no tienen revisión profesional ni publicación automática.

Son formatos de organización, no nuevos protocolos clínicos. Las indicaciones se copian del registro del odontólogo sin agregar tratamientos, medicamentos, dosis, duraciones ni contactos. El backend exige atención realizada, procedimiento confirmado e indicaciones profesionales registradas.

## Servicios incluidos

Evaluación odontológica, Limpieza dental, Profilaxis, Fluorización, Restauración dental, Control odontológico, Evaluación General, Limpieza / Profilaxis, Ortodoncia Inicial, Implante Dental, Restauración Estética y Blanqueamiento Dental.

## Contenido del formato

```text
Servicio: [nombre del servicio]
Procedimiento confirmado: {{procedimiento}}

Indicaciones registradas por su odontólogo:
{{indicaciones_profesional}}

Observaciones registradas de esta atención:
{{observaciones}}

Si necesita aclarar el significado de estas indicaciones, consulte al odontólogo que las emitió.
```

## Activación en el sistema

1. El odontólogo abre «Continuidad y revisión supervisada → Plantillas y políticas: revisión y publicación».
2. Comprueba el servicio, despliega «Ver contenido y procedencia antes de revisar» y, si está conforme, pulsa «Revisar profesionalmente».
3. Administración publica la propuesta revisada mediante «Publicar política revisada».
4. El odontólogo puede preparar el borrador de una atención realizada del servicio correspondiente. Cada borrador sigue necesitando revisión, aprobación y emisión explícita.

La numeración de versión de política es global para el código PLANTILLA_INDICACIONES, conforme a la restricción existente UQ_PoliticaCustomer(codigo,version). Cada registro está asociado a su propio servicio.

## Reproducibilidad

El generador está en backend/src/modules/customer/ai-agent/templates/aftercareTemplates.ts. El script backend/scripts/create-ia10-aftercare-templates.ts muestra una vista previa sin --apply. Con --apply crea las propuestas faltantes en una transacción y registra auditoría de preparación por asistente; no repite el conjunto existente ni altera revisiones o publicaciones.
