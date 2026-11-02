-- SOLO COPIA DE PRUEBAS. Requiere el script 06 principal actualizado.
-- Prueba la rutina real, sin copiar su ETL. Reversion al final; pueden quedar saltos IDENTITY.
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @marca VARCHAR(150)='[PRUEBA_CONFIABILIDAD_06] '+CONVERT(VARCHAR(36),NEWID());
    DECLARE @campana INT,@gasto INT,@gasto_cero INT,@fecha DATE,@canal INT;
    SELECT @fecha=DATEADD(DAY,1,MAX(id_fecha)) FROM NexoSalud_Mart.dbo.Dim_Tiempo;
    SET @fecha=COALESCE(@fecha,CAST(SYSDATETIME() AS DATE));
    SELECT TOP (1) @canal=id_canal FROM dbo.Canales ORDER BY id_canal;
    IF @canal IS NULL THROW 51530,'Cargar catalogos antes de probar.',1;

    -- Campana nueva sin personas: verifica que la inversion no depende de contactos.
    INSERT dbo.Campanas (nombre,id_canal) VALUES (@marca,@canal);
    SET @campana=CONVERT(INT,SCOPE_IDENTITY());
    INSERT dbo.GastosCampana (id_campana,fecha,importe,descripcion)
        VALUES (@campana,@fecha,100.01,@marca);
    SET @gasto=CONVERT(INT,SCOPE_IDENTITY());
    INSERT dbo.GastosCampana (id_campana,fecha,importe,descripcion)
        VALUES (@campana,@fecha,0.00,@marca+' cero explicito');
    SET @gasto_cero=CONVERT(INT,SCOPE_IDENTITY());

    EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer fi
                   JOIN NexoSalud_Mart.dbo.Dim_Tiempo dt ON dt.KeyTiempo=fi.KeyTiempo
                   WHERE fi.id_gasto=@gasto AND dt.id_fecha=@fecha AND fi.monto_inversion=100.01)
        THROW 51531,'No se conservo el gasto con fecha nueva y sin contactos.',1;
    IF NOT EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer
                   WHERE id_gasto=@gasto_cero AND monto_inversion=0)
        THROW 51532,'No se conservo el gasto explicito cero.',1;
    IF EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer
               WHERE id_gasto IN (@gasto,@gasto_cero) AND (impresiones IS NOT NULL OR clics IS NOT NULL))
        THROW 51533,'Se inventaron metricas de alcance.',1;

    EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
    IF (SELECT COUNT(*) FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer
        WHERE id_gasto IN (@gasto,@gasto_cero))<>2
        THROW 51534,'La repeticion duplico o perdio gastos.',1;
    IF EXISTS (SELECT id_gasto,importe,fecha FROM dbo.GastosCampana
               EXCEPT SELECT id_gasto,monto_inversion,fecha_gasto
                      FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer)
       OR EXISTS (SELECT id_gasto,monto_inversion,fecha_gasto
                  FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer
                  EXCEPT SELECT id_gasto,importe,fecha FROM dbo.GastosCampana)
        THROW 51535,'Origen y destino no coinciden gasto a gasto.',1;

    -- La eliminacion en origen tambien se refleja; todo se revierte al terminar.
    DELETE dbo.GastosCampana WHERE id_gasto=@gasto_cero;
    EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
    IF EXISTS (SELECT 1 FROM NexoSalud_Mart.dbo.fact_inversion_campana_buyer WHERE id_gasto=@gasto_cero)
        THROW 51536,'Un gasto eliminado permanece en el Mart.',1;

    -- Regresion del filtro literal: un texto corriente no puede seleccionarse.
    DECLARE @descripciones TABLE (descripcion VARCHAR(100));
    INSERT @descripciones VALUES ('Pauta publicitaria real'),('[PRUEBA_GERMAIN] Gasto simulado');
    IF (SELECT COUNT(*) FROM @descripciones WHERE CHARINDEX('[PRUEBA_GERMAIN]',descripcion)>0)<>1
        THROW 51537,'El filtro literal selecciona datos ajenos.',1;

    ROLLBACK TRANSACTION;
    PRINT 'OK: fecha nueva, campana sin contactos, cero explicito, NULL, repeticion, conciliacion, eliminacion y filtro literal. Datos de prueba revertidos.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
