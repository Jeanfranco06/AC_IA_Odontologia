:r .\database\lead_revision\mart_hechos\00_CONTEXTO_QA.sql
BEGIN TRANSACTION;

DECLARE @bloqueo int, @corte datetime2(7)=SYSUTCDATETIME();
EXEC @bloqueo=[$(Origen)].sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
 @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000,@DbPrincipal='public';
IF @bloqueo<0 THROW 54902,'El recurso compartido de carga está ocupado.',1;

-- El corte y las identidades son los mismos de R1, R2 y R3.
SELECT * INTO #Solicitudes FROM [$(Origen)].dbo.fn_Lead_Oportunidades_Corte(@corte);
SELECT * INTO #Raices FROM [$(Origen)].dbo.fn_Lead_Propuestas_Corte(@corte);
SELECT * INTO #Opciones FROM [$(Origen)].dbo.fn_Lead_Alternativas_Corte(@corte);

IF EXISTS (SELECT id_solicitud FROM #Solicitudes GROUP BY id_solicitud HAVING COUNT(*)>1)
 OR EXISTS (SELECT id_propuesta_logica FROM #Raices GROUP BY id_propuesta_logica HAVING COUNT(*)>1)
 OR EXISTS (SELECT id_opcion FROM #Opciones GROUP BY id_opcion HAVING COUNT(*)>1)
 THROW 54903,'El origen duplicó una identidad de negocio.',1;
IF EXISTS (SELECT 1 FROM #Solicitudes WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo>1)
 OR EXISTS (SELECT 1 FROM #Raices WHERE propuesta_aceptada+propuesta_rechazada>1
            OR propuesta_rechazada_economica>propuesta_rechazada)
 OR EXISTS (SELECT 1 FROM #Opciones WHERE alternativa_aceptada+alternativa_rechazada>1
            OR alternativa_rechazada_incompatibilidad>alternativa_rechazada)
 THROW 54904,'El origen contiene medidas incompatibles.',1;
IF EXISTS (
 SELECT 1 FROM #Opciones o LEFT JOIN #Solicitudes s ON s.id_solicitud=o.id_solicitud
 WHERE o.alternativa_aceptada+o.alternativa_rechazada=1 AND s.id_solicitud IS NULL)
 THROW 54905,'Una opción resuelta no tiene oportunidad LEAD al corte. Revisar su servicio y evidencia.',1;

-- Un identificador de origen nulo busca el miembro de control por su ID
-- natural. Nunca se sustituye una clave de origen explícita sin correspondencia.
SELECT t.KeyTiempo,v.KeyServicio,c.KeyCanal,z.KeySede,n.KeyNegociador,
 s.oportunidad_aceptada,s.oportunidad_cerrada_sin_acuerdo
INTO #Oportunidad
FROM #Solicitudes s
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,s.fecha_solicitud)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(s.id_servicio,0)
LEFT JOIN dbo.Dim_Canal c ON c.id_canal=ISNULL(s.id_canal_origen,0)
LEFT JOIN dbo.Dim_Sede z ON z.id_sede=ISNULL(s.id_sede_interes_lead,0)
LEFT JOIN dbo.Dim_Negociador n ON n.id_usuario=ISNULL(s.id_negociador,0)
WHERE s.oportunidad_aceptada+s.oportunidad_cerrada_sin_acuerdo=1;

SELECT t.KeyTiempo,v.KeyServicio,p.KeyPromocion,m.KeyMotivoRechazo,
 r.propuesta_aceptada,r.propuesta_rechazada,r.propuesta_rechazada_economica
INTO #Propuesta
FROM #Raices r
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,r.fecha_presentacion)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(r.id_servicio,0)
LEFT JOIN dbo.Dim_Promocion p ON p.id_promocion=r.id_promocion_lead
 OR (r.id_promocion_lead IS NULL AND p.Origen='TEXTO'
     AND p.PromocionAplicada=CONVERT(nvarchar(150),TRIM(r.promocion_aplicada)) COLLATE Latin1_General_100_BIN2)
 -- La OLTP no distingue una negativa explícita de un campo sin informar.
 OR (r.id_promocion_lead IS NULL AND NULLIF(TRIM(r.promocion_aplicada),'') IS NULL
     AND p.Origen='NO_ESPECIFICADO')
LEFT JOIN dbo.Dim_MotivoRechazo m ON r.propuesta_rechazada=1
 AND ((m.id_motivo_rechazo=r.id_motivo_rechazo_lead AND m.Ambito='PROPUESTA')
 OR (r.id_motivo_rechazo_lead IS NULL AND m.id_motivo_rechazo IS NULL AND m.MotivoRechazo=N'No especificado'))
WHERE r.propuesta_aceptada+r.propuesta_rechazada=1;

-- Se reproduce la clave natural de Horario, incluso si faltan día o turno.
SELECT o.*,s.id_servicio,
 COALESCE(o.pref_dia_semana_lead,((DATEDIFF(day,CONVERT(date,'19000101',112),o.pref_fecha_lead)%7+7)%7)+1) AS DiaPreferido,
 ((DATEDIFF(day,CONVERT(date,'19000101',112),o.fecha_disponibilidad)%7+7)%7)+1 AS DiaOfrecido,
 NULLIF(TRIM(o.pref_turno_lead),'') AS TurnoPreferido,
 NULLIF(TRIM(o.ofr_turno_lead),'') AS TurnoOfrecido
INTO #HorarioOpcion
FROM #Opciones o
JOIN #Solicitudes s ON s.id_solicitud=o.id_solicitud
WHERE o.alternativa_aceptada+o.alternativa_rechazada=1;

SELECT t.KeyTiempo,v.KeyServicio,z.KeySede,d.KeyProfesional,
 hp.KeyHorario AS KeyHorarioPreferido,ho.KeyHorario AS KeyHorarioOfrecido,m.KeyMotivoRechazo,
 o.alternativa_aceptada,o.alternativa_rechazada,o.alternativa_rechazada_incompatibilidad
INTO #Alternativa
FROM #HorarioOpcion o
LEFT JOIN dbo.Dim_Tiempo t ON t.id_fecha=CONVERT(date,o.fecha_ofrecida)
LEFT JOIN dbo.Dim_Servicio v ON v.id_servicio=ISNULL(o.id_servicio,0)
LEFT JOIN dbo.Dim_Sede z ON z.id_sede=ISNULL(o.id_sede,0)
LEFT JOIN dbo.Dim_Profesional d ON d.id_profesional=ISNULL(o.id_profesional,0)
LEFT JOIN dbo.Dim_Horario hp ON
 (hp.TipoMiembro='OBSERVADO'
  AND (hp.NumeroDiaSemana=o.DiaPreferido OR (hp.NumeroDiaSemana IS NULL AND o.DiaPreferido IS NULL))
  AND (hp.Turno=o.TurnoPreferido OR (hp.Turno IS NULL AND o.TurnoPreferido IS NULL))
  AND ((hp.HoraInicio=o.pref_hora_inicio_lead AND hp.HoraFin=o.pref_hora_fin_lead)
       OR (hp.HoraInicio IS NULL AND o.pref_hora_inicio_lead IS NULL AND o.pref_hora_fin_lead IS NULL)))
 OR (hp.TipoMiembro='NO_ESPECIFICADO' AND o.DiaPreferido IS NULL AND o.TurnoPreferido IS NULL
     AND o.pref_hora_inicio_lead IS NULL AND o.pref_hora_fin_lead IS NULL)
LEFT JOIN dbo.Dim_Horario ho ON
 (ho.TipoMiembro='OBSERVADO'
  AND (ho.NumeroDiaSemana=o.DiaOfrecido OR (ho.NumeroDiaSemana IS NULL AND o.DiaOfrecido IS NULL))
  AND (ho.Turno=o.TurnoOfrecido OR (ho.Turno IS NULL AND o.TurnoOfrecido IS NULL))
  AND ((ho.HoraInicio=o.hora_inicio AND ho.HoraFin=o.hora_fin)
       OR (ho.HoraInicio IS NULL AND o.hora_inicio IS NULL AND o.hora_fin IS NULL)))
 OR (ho.TipoMiembro='NO_ESPECIFICADO' AND o.DiaOfrecido IS NULL AND o.TurnoOfrecido IS NULL
     AND o.hora_inicio IS NULL AND o.hora_fin IS NULL)
LEFT JOIN dbo.Dim_MotivoRechazo m ON o.alternativa_rechazada=1
 AND ((m.id_motivo_rechazo=o.id_motivo_rechazo_lead AND m.Ambito='ALTERNATIVA')
 OR (o.id_motivo_rechazo_lead IS NULL AND m.id_motivo_rechazo IS NULL AND m.MotivoRechazo=N'No especificado'));

IF EXISTS (SELECT 1 FROM #Oportunidad WHERE KeyTiempo IS NULL OR KeyServicio IS NULL
            OR KeyCanal IS NULL OR KeySede IS NULL OR KeyNegociador IS NULL)
 OR EXISTS (SELECT 1 FROM #Propuesta WHERE KeyTiempo IS NULL OR KeyServicio IS NULL OR KeyPromocion IS NULL
            OR (propuesta_rechazada=1 AND KeyMotivoRechazo IS NULL))
 OR EXISTS (SELECT 1 FROM #Alternativa WHERE KeyTiempo IS NULL OR KeyServicio IS NULL OR KeySede IS NULL
            OR KeyProfesional IS NULL OR KeyHorarioPreferido IS NULL OR KeyHorarioOfrecido IS NULL
            OR (alternativa_rechazada=1 AND KeyMotivoRechazo IS NULL))
 THROW 54906,'No se pudo resolver un miembro dimensional. Revisar el origen o actualizar dimensiones en QA.',1;
IF (SELECT COUNT_BIG(*) FROM #Oportunidad)<>(SELECT COUNT_BIG(*) FROM #Solicitudes WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo=1)
 OR (SELECT COUNT_BIG(*) FROM #Propuesta)<>(SELECT COUNT_BIG(*) FROM #Raices WHERE propuesta_aceptada+propuesta_rechazada=1)
 OR (SELECT COUNT_BIG(*) FROM #Alternativa)<>(SELECT COUNT_BIG(*) FROM #Opciones WHERE alternativa_aceptada+alternativa_rechazada=1)
 THROW 54907,'Una unión dimensional multiplicó o perdió filas de negocio.',1;

-- F1. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador,
       SUM(CONVERT(bigint,oportunidad_aceptada)) AS oportunidad_aceptada,
       SUM(CONVERT(bigint,oportunidad_cerrada_sin_acuerdo)) AS oportunidad_cerrada_sin_acuerdo
INTO #F1
FROM #Oportunidad
WHERE oportunidad_aceptada+oportunidad_cerrada_sin_acuerdo=1
GROUP BY KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador;

MERGE dbo.fact_oportunidades_lead WITH (HOLDLOCK) AS d
USING #F1 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyCanal=s.KeyCanal AND
    d.KeySede=s.KeySede AND
    d.KeyNegociador=s.KeyNegociador
WHEN MATCHED AND (d.oportunidad_aceptada<>s.oportunidad_aceptada OR d.oportunidad_cerrada_sin_acuerdo<>s.oportunidad_cerrada_sin_acuerdo) THEN
 UPDATE SET oportunidad_aceptada=s.oportunidad_aceptada, oportunidad_cerrada_sin_acuerdo=s.oportunidad_cerrada_sin_acuerdo
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyCanal, KeySede, KeyNegociador, oportunidad_aceptada, oportunidad_cerrada_sin_acuerdo)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyCanal, s.KeySede, s.KeyNegociador, s.oportunidad_aceptada, s.oportunidad_cerrada_sin_acuerdo)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F2. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyPromocion,
       COUNT_BIG(*) AS propuesta_aceptada
INTO #F2
FROM #Propuesta
WHERE propuesta_aceptada=1
GROUP BY KeyTiempo, KeyServicio, KeyPromocion;

MERGE dbo.fact_propuestas_aceptadas_lead WITH (HOLDLOCK) AS d
USING #F2 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyPromocion=s.KeyPromocion
WHEN MATCHED AND (d.propuesta_aceptada<>s.propuesta_aceptada) THEN
 UPDATE SET propuesta_aceptada=s.propuesta_aceptada
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyPromocion, propuesta_aceptada)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyPromocion, s.propuesta_aceptada)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F3. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo,
       COUNT_BIG(*) AS propuesta_rechazada,
       SUM(CONVERT(bigint,propuesta_rechazada_economica)) AS propuesta_rechazada_economica
INTO #F3
FROM #Propuesta
WHERE propuesta_rechazada=1
GROUP BY KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo;

MERGE dbo.fact_propuestas_rechazadas_lead WITH (HOLDLOCK) AS d
USING #F3 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeyPromocion=s.KeyPromocion AND
    d.KeyMotivoRechazo=s.KeyMotivoRechazo
WHEN MATCHED AND (d.propuesta_rechazada<>s.propuesta_rechazada OR d.propuesta_rechazada_economica<>s.propuesta_rechazada_economica) THEN
 UPDATE SET propuesta_rechazada=s.propuesta_rechazada, propuesta_rechazada_economica=s.propuesta_rechazada_economica
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeyPromocion, KeyMotivoRechazo, propuesta_rechazada, propuesta_rechazada_economica)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeyPromocion, s.KeyMotivoRechazo, s.propuesta_rechazada, s.propuesta_rechazada_economica)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F4. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido,
       COUNT_BIG(*) AS alternativa_aceptada
INTO #F4
FROM #Alternativa
WHERE alternativa_aceptada=1
GROUP BY KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido;

MERGE dbo.fact_alternativas_aceptadas_lead WITH (HOLDLOCK) AS d
USING #F4 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeySede=s.KeySede AND
    d.KeyProfesional=s.KeyProfesional AND
    d.KeyHorarioPreferido=s.KeyHorarioPreferido AND
    d.KeyHorarioOfrecido=s.KeyHorarioOfrecido
WHEN MATCHED AND (d.alternativa_aceptada<>s.alternativa_aceptada) THEN
 UPDATE SET alternativa_aceptada=s.alternativa_aceptada
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, alternativa_aceptada)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeySede, s.KeyProfesional, s.KeyHorarioPreferido, s.KeyHorarioOfrecido, s.alternativa_aceptada)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- F5. Una fila por combinación de sus claves dimensionales.
SELECT KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo,
       COUNT_BIG(*) AS alternativa_rechazada,
       SUM(CONVERT(bigint,alternativa_rechazada_incompatibilidad)) AS alternativa_rechazada_incompatibilidad
INTO #F5
FROM #Alternativa
WHERE alternativa_rechazada=1
GROUP BY KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo;

MERGE dbo.fact_alternativas_rechazadas_lead WITH (HOLDLOCK) AS d
USING #F5 AS s
 ON d.KeyTiempo=s.KeyTiempo AND
    d.KeyServicio=s.KeyServicio AND
    d.KeySede=s.KeySede AND
    d.KeyProfesional=s.KeyProfesional AND
    d.KeyHorarioPreferido=s.KeyHorarioPreferido AND
    d.KeyHorarioOfrecido=s.KeyHorarioOfrecido AND
    d.KeyMotivoRechazo=s.KeyMotivoRechazo
WHEN MATCHED AND (d.alternativa_rechazada<>s.alternativa_rechazada OR d.alternativa_rechazada_incompatibilidad<>s.alternativa_rechazada_incompatibilidad) THEN
 UPDATE SET alternativa_rechazada=s.alternativa_rechazada, alternativa_rechazada_incompatibilidad=s.alternativa_rechazada_incompatibilidad
WHEN NOT MATCHED BY TARGET THEN
 INSERT (KeyTiempo, KeyServicio, KeySede, KeyProfesional, KeyHorarioPreferido, KeyHorarioOfrecido, KeyMotivoRechazo, alternativa_rechazada, alternativa_rechazada_incompatibilidad)
 VALUES (s.KeyTiempo, s.KeyServicio, s.KeySede, s.KeyProfesional, s.KeyHorarioPreferido, s.KeyHorarioOfrecido, s.KeyMotivoRechazo, s.alternativa_rechazada, s.alternativa_rechazada_incompatibilidad)
WHEN NOT MATCHED BY SOURCE THEN DELETE;

-- Además de los totales, comparar cada combinación dimensional persistida.
IF EXISTS (SELECT * FROM #F1 EXCEPT SELECT * FROM dbo.fact_oportunidades_lead)
 OR EXISTS (SELECT * FROM dbo.fact_oportunidades_lead EXCEPT SELECT * FROM #F1)
 THROW 54909,'Los grupos persistidos de F1 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F2 EXCEPT SELECT * FROM dbo.fact_propuestas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_aceptadas_lead EXCEPT SELECT * FROM #F2)
 THROW 54909,'Los grupos persistidos de F2 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F3 EXCEPT SELECT * FROM dbo.fact_propuestas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_propuestas_rechazadas_lead EXCEPT SELECT * FROM #F3)
 THROW 54909,'Los grupos persistidos de F3 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F4 EXCEPT SELECT * FROM dbo.fact_alternativas_aceptadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_aceptadas_lead EXCEPT SELECT * FROM #F4)
 THROW 54909,'Los grupos persistidos de F4 no coinciden con la carga.',1;
IF EXISTS (SELECT * FROM #F5 EXCEPT SELECT * FROM dbo.fact_alternativas_rechazadas_lead)
 OR EXISTS (SELECT * FROM dbo.fact_alternativas_rechazadas_lead EXCEPT SELECT * FROM #F5)
 THROW 54909,'Los grupos persistidos de F5 no coinciden con la carga.',1;

-- Usar exactamente el corte de la extracción antes de confirmar.
:r .\database\lead_revision\mart_hechos\03_COMPARAR_MEDIDAS.sql
DROP TABLE #F1,#F2,#F3,#F4,#F5,#Solicitudes,#Raices,#Opciones,
 #Oportunidad,#Propuesta,#HorarioOpcion,#Alternativa;
COMMIT TRANSACTION;
SELECT @corte AS CorteUTC;
GO
