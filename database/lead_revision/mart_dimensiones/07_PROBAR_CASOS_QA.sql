:ON ERROR EXIT
IF DB_NAME() NOT IN (N'NexoSalud_Mart_LeadQA',N'NexoSalud_Mart_LeadPreQA') THROW 54740,'Solo copia QA.',1;
BEGIN TRANSACTION;
:r .\database\lead_revision\mart_dimensiones\06_DATOS_QA.sql
GO
:r .\database\lead_revision\mart_dimensiones\03_CARGAR_DIMENSIONES.sql
GO
IF (SELECT COUNT(*) FROM dbo.Dim_Promocion WHERE PromocionAplicada=N'QA Mart LEAD promoción'
 AND Origen IN ('CATALOGO','TEXTO'))<>2
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_Promocion WHERE KeyPromocion=-1 AND Origen='SIN_PROMOCION')
 THROW 54741,'Promoción duplicada por versión o texto unido sin evidencia.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Dim_MotivoRechazo WHERE Codigo='QA-MART-ECON' AND Ambito='PROPUESTA' AND TipoMotivoRechazo='ECONOMICO')
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_MotivoRechazo WHERE Codigo='QA-MART-INCOMP' AND Ambito='ALTERNATIVA' AND TipoMotivoRechazo='INCOMPATIBILIDAD')
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_MotivoRechazo WHERE Codigo='QA-MART-OTRO' AND Ambito='ALTERNATIVA' AND TipoMotivoRechazo='OTROS')
 THROW 54742,'Los ámbitos o categorías de rechazo no se conservaron.',1;
IF (SELECT COUNT(*) FROM dbo.Dim_Horario WHERE NumeroDiaSemana IN(2,3) AND Turno=N'QA Mañana'
 AND HoraInicio='09:00' AND HoraFin='11:00')<>2
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_Horario WHERE NumeroDiaSemana=2 AND DiaSemana=N'Martes' AND Turno=N'QA Mañana'
  AND HoraInicio IS NULL AND HoraFin IS NULL AND IntervaloHorario IS NULL)
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_Horario WHERE Turno=N'QA Tarde' AND HoraInicio IS NOT NULL)
 THROW 54743,'Horario preferido, ofrecido o parcial incorrecto.',1;
IF (SELECT COUNT(*) FROM dbo.Dim_Tiempo WHERE id_fecha IN('20420106','20420107'))<>2
 THROW 54744,'Faltan fechas de las operaciones de prueba.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Dim_Profesional WHERE Odontologo='QA Mart Sin especialidad' AND EspecialidadPrincipal IS NULL)
 OR NOT EXISTS(SELECT 1 FROM dbo.Dim_Sede WHERE Sede='QA Mart sede sin zona' AND Distrito IS NULL AND Zona IS NULL)
 THROW 54750,'Se inventó especialidad, distrito o zona para una fuente incompleta.',1;
ROLLBACK;
SELECT 'Escenarios sintéticos aprobados y revertidos' AS Resultado;
