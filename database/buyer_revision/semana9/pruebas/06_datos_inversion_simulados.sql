-- OPCIONAL. Solo en una copia de pruebas, despues del script 06 principal.
-- Importes simulados del ejemplo de Germain: no representan facturas de la clinica.
-- No limpia ni sustituye gastos anteriores. No usar el total como KPI real.
USE NexoSaludDB;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;
    DECLARE @bloqueo INT;
    EXEC @bloqueo=sys.sp_getapplock @Resource='ETL_BUYER_SEMANA9',
        @LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;
    IF @bloqueo<0 THROW 51520,'Otro ETL Buyer esta en ejecucion.',1;
    DECLARE @Ejemplos TABLE (id_campana INT,fecha DATE,importe DECIMAL(10,2),descripcion VARCHAR(300));
    INSERT @Ejemplos VALUES
        (1,'20260915',1500.00,'[PRUEBA_INVERSION_06] WhatsApp - importe simulado'),
        (2,'20260915',850.00,'[PRUEBA_INVERSION_06] Instagram - importe simulado'),
        (3,'20260915',450.00,'[PRUEBA_INVERSION_06] Facebook - importe simulado'),
        (4,'20260910',200.00,'[PRUEBA_INVERSION_06] SEO - importe simulado'),
        (5,'20260910',100.00,'[PRUEBA_INVERSION_06] Maps - importe simulado');
    IF EXISTS (SELECT 1 FROM @Ejemplos e LEFT JOIN dbo.Campanas c ON c.id_campana=e.id_campana
               WHERE c.id_campana IS NULL)
        THROW 51521,'Este ejemplo requiere los catalogos originales de Semana 9.',1;
    INSERT dbo.GastosCampana (id_campana,fecha,importe,descripcion)
    SELECT e.id_campana,e.fecha,e.importe,e.descripcion FROM @Ejemplos e
    WHERE NOT EXISTS (SELECT 1 FROM dbo.GastosCampana g
                      WHERE g.id_campana=e.id_campana AND g.fecha=e.fecha AND g.descripcion=e.descripcion);
    EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
