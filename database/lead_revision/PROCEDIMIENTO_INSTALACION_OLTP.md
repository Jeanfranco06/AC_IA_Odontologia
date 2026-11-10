# Instalación OLTP de BUYER y LEAD

## Alcance y archivos exactos

Punto de entrada: APLICAR_BUYER_LEAD.sql. Incluye primero 01_BUYER_OLTP.sql, extraído del bloque OLTP de database/buyer_revision/semana9/migracion_buyer.sql. Luego incluye INSTALAR_LEAD_COMPLETO.sql. Ejecutar desde la raíz del repositorio. La sesión debe apuntar al destino indicado en BaseEsperada. SQLCMD detiene la ejecución ante un error. Los dos bloques quedan dentro de una sola transacción externa. La carga inicial de auditoría conserva el estado observado y deja sin clasificar los resultados históricos sin evidencia.

| Archivo | SHA-256 del ensayo |
| --- | --- |
| APLICAR_BUYER_LEAD.sql | E704FB645EB487DEB412321C156709A28F311B893A1B00B24E63D2A74DDB9C85 |
| 01_BUYER_OLTP.sql | E2662D9DE27357268E722EE5EBDE9D9CB56B0039586E06DA958E99F9FEF82074 |
| INSTALAR_LEAD_COMPLETO.sql | B841A4E40E40E9A3D3B6D548E895485F5BE09F16CD651018FFF6D646A9416678 |
| COMPARAR_COPIAS_LEAD.sql | EB61B5140B53717F98693BE27B60C0AA13D29DB827BA6C45555DFAFF444DAC63 |
| VERIFICAR_FILAS_COPIAS_LEAD.sql | F2B6769FBC36847C9F72317B78AF4756B003A82845EC49D72A7CB0429498C56A |
| VERIFICAR_OLTP_INSTALADO.sql | 51F7D1700161C10D203D08F8B930187C0441867A8103371C07A17474F86F3C75 |
| PRUEBA_INTEGRACION_LEAD.sql | 5691636BBF74FE7D0179F6FA0EC5169990BDD3F1A4BCED57AD64F7D0F8E7DEB3 |

Usar los archivos de la revisión aprobada y verificar las huellas antes de la ventana. Un cambio de bytes exige revisar y volver a ensayar el paquete, incluidas las conversiones de fin de línea al copiarlo entre equipos.

## Ventana autorizada

1. Confirmar servidor, nombre de base, rama y huellas. Detener los escritores de OLTP antes de instalar, incluidos backend, trabajos de carga y tareas programadas con acceso de escritura. Confirmar que no hay transacciones de aplicación abiertas. Reservar espacio para respaldo, restauración y crecimiento del log.
2. Tomar un nuevo respaldo completo COPY_ONLY con CHECKSUM durante esa pausa. Ejecutar RESTORE VERIFYONLY con CHECKSUM, restaurar con MOVE a una base de referencia de nombre y archivos exclusivos y ejecutar DBCC CHECKDB. Registrar ruta, SHA-256, hora del servidor, UUID y LSN del conjunto. Conservar esa referencia sin migrar. La referencia que se pase a los scripts debe corresponder a la captura de la ventana. Para la ventana usar NexoSalud_LeadVentana con rutas de datos y log independientes. Si ya existe, detenerse y acordar un nuevo destino antes de restaurar. Conservar las referencias previas y sus respaldos.
3. Con las escrituras detenidas, comparar el catálogo y los registros originales de la referencia con NexoSaludDB. El esquema debe coincidir y las 31 tablas compartidas deben mostrar las mismas cantidades y cero filas originales sin coincidencia. Si hay diferencias, detener la instalación y explicarlas.
4. Ejecutar el siguiente comando solo después de la autorización explícita. El bloque primero instala BUYER y luego LEAD. El punto de entrada valida el destino y confirma la transacción después de verificar que ambos módulos quedaron instalados.

```powershell
sqlcmd -S localhost -E -C -I -b -d NexoSaludDB -f 65001 -v BaseEsperada=NexoSaludDB -i database/lead_revision/APLICAR_BUYER_LEAD.sql
```

5. Mantener la pausa de escrituras y ejecutar los controles de lectura. Comparar el inventario con el ensayo y exigir que el diferencial corresponda únicamente al paquete aprobado. Comprobar los valores anteriores de las 31 tablas, los conteos y las restricciones. Guardar las salidas y los códigos de retorno. Una fila de DBCC CHECKCONSTRAINTS o una restricción deshabilitada o no confiable exige revisión antes de reabrir.

```powershell
sqlcmd -S localhost -E -C -b -d master -W -w 65535 -s '|' -f 65001 -v Referencia=NexoSalud_LeadVentana Destino=NexoSaludDB -i database/lead_revision/COMPARAR_COPIAS_LEAD.sql
sqlcmd -S localhost -E -C -b -d master -W -s '|' -f 65001 -v Referencia=NexoSalud_LeadVentana Destino=NexoSaludDB -i database/lead_revision/VERIFICAR_FILAS_COPIAS_LEAD.sql
sqlcmd -S localhost -E -C -I -b -d NexoSaludDB -W -f 65001 -v BaseEsperada=NexoSaludDB -i database/lead_revision/VERIFICAR_OLTP_INSTALADO.sql
```

6. Verificar la conversión y los ocho campos. El control de lectura comprueba el vínculo entre captación, evento y solicitud, el grano de M1–M8 y las fórmulas L1–L3. Si todavía no hay conversiones documentadas, registrar esa ausencia. Para una prueba de escritura posterior al despliegue, restaurar una copia de la base ya migrada con el nombre NexoSalud_LeadVerificacion y ejecutar PRUEBA_INTEGRACION_LEAD.sql allí, con rollback. El script de pruebas rechaza NexoSaludDB. La primera conversión real se valida con una operación de negocio autorizada y un reintento controlado. Los indicadores sin casos resueltos devuelven NULL.
7. Registrar aprobación y reanudar los escritores. Preparar un commit SQL y documentación en lead con una lista explícita de archivos. Mantener las evidencias locales y archivos .bak fuera de Git. El backend y el frontend preexistentes quedan fuera de ese commit.

## Criterios para detenerse y recuperación

Un error de SQLCMD, deriva de esquema, datos originales faltantes o restricción inválida detiene la ventana. Si el instalador aborta, mantener los escritores detenidos, cerrar la sesión si sigue abierta y comprobar que SQL Server revirtió la transacción. Guardar la salida y comparar nuevamente la referencia. Si ya hubo confirmación y se detecta un problema, restaurar el respaldo verificado con otro nombre y comprobarlo antes de acordar un retorno. Si hubo escrituras posteriores al respaldo, conservarlas y fijar el punto de recuperación con quien administra la base. La restauración sobre la principal o un cambio de conexión requieren una decisión separada. El paquete no incluye inicializadores destructivos ni carga del Data Mart.
