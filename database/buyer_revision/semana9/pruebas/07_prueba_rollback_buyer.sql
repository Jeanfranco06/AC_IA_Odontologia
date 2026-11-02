-- SOLO COPIA DE PRUEBAS. Detener backend y otras cargas mientras se ejecuta.
-- Instalar primero el bloque 1 de poblamiento_merge_mart.sql.
-- Inyecta un fallo despues del INSERT del hecho; el trigger se crea dentro de una
-- transaccion que debe revertirse junto con la carga. No utilizar en produccion.
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID('NexoSalud_Mart.dbo.tr_PruebaRollbackBuyer','TR') IS NOT NULL
    THROW 51591,'Ya existe el trigger de prueba: revisar antes de continuar.',1;
IF OBJECT_ID('tempdb..#BuyerAntes') IS NOT NULL DROP TABLE #BuyerAntes;
SELECT * INTO #BuyerAntes FROM NexoSalud_Mart.dbo.fact_captacion_buyer;
BEGIN TRY
    BEGIN TRANSACTION;
    EXEC NexoSalud_Mart.sys.sp_executesql N'
        CREATE TRIGGER dbo.tr_PruebaRollbackBuyer
        ON dbo.fact_captacion_buyer AFTER INSERT AS
        BEGIN
            THROW 51590, ''Fallo de prueba despues del INSERT Buyer.'', 1;
        END;';
    EXEC dbo.usp_SincronizarCaptacionBuyer;
    ROLLBACK TRANSACTION;
    THROW 51592,'No se produjo el fallo esperado.',1;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    IF ERROR_NUMBER()<>51590 THROW;
END CATCH;
IF OBJECT_ID('NexoSalud_Mart.dbo.tr_PruebaRollbackBuyer','TR') IS NOT NULL
    THROW 51593,'El trigger de prueba no se revirtio.',1;
IF EXISTS (SELECT * FROM #BuyerAntes EXCEPT SELECT * FROM NexoSalud_Mart.dbo.fact_captacion_buyer)
   OR EXISTS (SELECT * FROM NexoSalud_Mart.dbo.fact_captacion_buyer EXCEPT SELECT * FROM #BuyerAntes)
   OR (SELECT COUNT_BIG(*) FROM #BuyerAntes)<>(SELECT COUNT_BIG(*) FROM NexoSalud_Mart.dbo.fact_captacion_buyer)
    THROW 51594,'El hecho cambio pese al rollback.',1;
DROP TABLE #BuyerAntes;
PRINT 'OK: fallo provocado y estado anterior del hecho conservado; trigger revertido.';
GO
