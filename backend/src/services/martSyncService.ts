import { queryMart } from '../db/mart';

/** Carga exclusivamente Buyer. Las otras fases conservan su ETL propio. */
export class MartSyncService {
  private static lastSyncTimestamp = 0;
  private static inFlight: Promise<number> | null = null;

  public static syncBuyer(): Promise<number> {
    if (this.inFlight) return this.inFlight;
    // Instalar primero el bloque 1 de poblamiento_merge_mart.sql y el archivo 06.
    // Una sola transaccion incluye ambos hechos. Los procedimientos usan el mismo bloqueo.
    this.inFlight = queryMart(`
      SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRANSACTION;
        EXEC NexoSaludDB.dbo.usp_SincronizarCaptacionBuyer;
        EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;
        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH;
    `).then(() => {
      this.lastSyncTimestamp = Date.now();
      return this.lastSyncTimestamp;
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  public static async syncInversionCampanaBuyer(): Promise<void> {
    await queryMart('EXEC NexoSalud_Mart.dbo.usp_SincronizarInversionCampanaBuyer;');
  }

  public static async syncPayer(): Promise<void> {
    await queryMart(`
      IF OBJECT_ID('NexoSalud_Mart.dbo.usp_ETL_SincronizarPayerMart', 'P') IS NOT NULL
        EXEC NexoSalud_Mart.dbo.usp_ETL_SincronizarPayerMart;
    `);
  }

  public static async syncCustomer(): Promise<void> {
    await queryMart(`
      IF OBJECT_ID('NexoSalud_Mart.dbo.usp_ETL_SincronizarCustomerMart', 'P') IS NOT NULL
        EXEC NexoSalud_Mart.dbo.usp_ETL_SincronizarCustomerMart;
    `);
  }

  public static async syncAll(force: boolean = false): Promise<void> {
    if (!force && Date.now() - this.lastSyncTimestamp < 10000) return;
    await this.syncBuyer();
  }
}
