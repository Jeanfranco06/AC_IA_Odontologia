import { MartSyncService } from '../services/martSyncService';

// Requiere instalar previamente los procedimientos del paquete buyer_revision.
// No instala esquemas ni recarga las otras fases.
MartSyncService.syncBuyer()
  .then(() => {
    console.log('ETL Buyer completado: captacion e inversion sincronizadas.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error ejecutando ETL Buyer:', error);
    process.exit(1);
  });
