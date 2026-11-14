import { prisma } from '../db';

async function updateConstraint() {
  await prisma.$executeRawUnsafe(`
    IF EXISTS (
      SELECT 1 FROM sys.check_constraints cc 
      INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id 
      WHERE cc.name = 'CK_Seguimientos_Satisfaccion' AND t.name = 'Seguimientos'
    )
    BEGIN
      ALTER TABLE [dbo].[Seguimientos] DROP CONSTRAINT [CK_Seguimientos_Satisfaccion];
    END
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE [dbo].[Seguimientos] ADD CONSTRAINT [CK_Seguimientos_Satisfaccion] CHECK (satisfaccion IS NULL OR satisfaccion BETWEEN 0 AND 10);
  `);

  console.log('✅ Constraint CK_Seguimientos_Satisfaccion actualizado exitosamente en NexoSaludDB.');
}

updateConstraint().catch(console.error).finally(() => prisma.$disconnect());
