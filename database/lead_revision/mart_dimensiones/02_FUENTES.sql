-- Datos fuente de uso común para carga y conciliación. No escribe en la OLTP.
IF OBJECT_ID(N'[$(Origen)].dbo.HistorialOpcionesLead','U') IS NULL
 OR OBJECT_ID(N'[$(Origen)].dbo.v_OrigenMedidasOportunidadLead','V') IS NULL
 THROW 54714,'La fuente no tiene la revisión OLTP de LEAD.',1;

SELECT id_fecha INTO #Fechas FROM (
 SELECT CAST(fecha_solicitud AS date) AS id_fecha FROM [$(Origen)].dbo.v_OrigenMedidasOportunidadLead
 UNION SELECT CAST(fecha_ingreso_lead AS date) FROM [$(Origen)].dbo.HistorialSolicitudesLead
 UNION SELECT CAST(fecha_decision_comercial_lead AS date) FROM [$(Origen)].dbo.HistorialSolicitudesLead
 UNION SELECT CAST(fecha_presentacion AS date) FROM [$(Origen)].dbo.HistorialPropuestasLead
 UNION SELECT CAST(fecha_decision AS date) FROM [$(Origen)].dbo.HistorialPropuestasLead
 UNION SELECT CAST(fecha_ofrecida AS date) FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT CAST(fecha_respuesta AS date) FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT fecha_disponibilidad FROM [$(Origen)].dbo.HistorialOpcionesLead
 UNION SELECT pref_fecha_lead FROM [$(Origen)].dbo.HistorialOpcionesLead
) fechas WHERE id_fecha IS NOT NULL;
CREATE UNIQUE CLUSTERED INDEX IX_Fechas ON #Fechas(id_fecha);

SELECT id_promocion,nombre,tipo_promocion,id_servicio,activo
INTO #Promocion FROM [$(Origen)].dbo.PromocionesLead;
SELECT DISTINCT CONVERT(nvarchar(150),TRIM(promocion_aplicada)) COLLATE Latin1_General_100_BIN2 AS Texto
INTO #PromocionTexto
FROM (
 SELECT id_promocion_lead,promocion_aplicada FROM [$(Origen)].dbo.PropuestasEconomicasLead
 UNION ALL
 SELECT id_promocion_lead,promocion_aplicada FROM [$(Origen)].dbo.HistorialPropuestasLead
) p WHERE id_promocion_lead IS NULL AND NULLIF(TRIM(promocion_aplicada),'') IS NOT NULL;

SELECT id_motivo_rechazo,codigo,ambito,categoria,motivo,activo
INTO #Motivo FROM [$(Origen)].dbo.MotivosRechazoLead;

SELECT DISTINCT NumeroDiaSemana,Turno,HoraInicio,HoraFin INTO #Horario
FROM (
 SELECT CONVERT(tinyint,COALESCE(pref_dia_semana_lead,
   ((DATEDIFF(day,CONVERT(date,'19000101',112),pref_fecha_lead)%7+7)%7)+1)) AS NumeroDiaSemana,
  CONVERT(nvarchar(30),NULLIF(TRIM(pref_turno_lead),'')) COLLATE DATABASE_DEFAULT AS Turno,
  pref_hora_inicio_lead AS HoraInicio,pref_hora_fin_lead AS HoraFin
 FROM [$(Origen)].dbo.HistorialOpcionesLead
 WHERE accion<>'DELETE'
 UNION ALL
 SELECT CONVERT(tinyint,((DATEDIFF(day,CONVERT(date,'19000101',112),fecha_disponibilidad)%7+7)%7)+1),
  CONVERT(nvarchar(30),NULLIF(TRIM(ofr_turno_lead),'')) COLLATE DATABASE_DEFAULT,hora_inicio,hora_fin
 FROM [$(Origen)].dbo.HistorialOpcionesLead WHERE accion<>'DELETE'
 UNION ALL
 SELECT dia_semana,CAST(NULL AS nvarchar(30)) COLLATE DATABASE_DEFAULT,hora_inicio,hora_fin
 FROM [$(Origen)].dbo.Horarios
) h
WHERE NumeroDiaSemana IS NOT NULL OR Turno IS NOT NULL OR HoraInicio IS NOT NULL OR HoraFin IS NOT NULL;

IF EXISTS (SELECT 1 FROM #Horario WHERE NumeroDiaSemana NOT BETWEEN 1 AND 7
 OR (HoraInicio IS NULL AND HoraFin IS NOT NULL)
 OR (HoraInicio IS NOT NULL AND HoraFin IS NULL) OR HoraInicio>=HoraFin)
 THROW 54715,'La fuente contiene un día o intervalo no válido; reconciliar el origen.',1;
