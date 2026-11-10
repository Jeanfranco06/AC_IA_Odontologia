# Resultado de instalación OLTP BUYER y LEAD

El 9 de noviembre de 2026 se instaló en NexoSaludDB el paquete aprobado BUYER → LEAD. Los dos bloques se confirmaron en una transacción, con una sesión exclusiva. El estado final registrado es ONLINE, MULTI_USER y READ_WRITE.

## Evidencia y resultados

- Se detuvieron las escrituras mediante el modo READ_ONLY antes del respaldo y de las verificaciones. No había conexiones de aplicación activas ni trabajos de SQL Agent dirigidos a la base.
- Se obtuvo un respaldo completo COPY_ONLY con CHECKSUM durante la ventana. Pasó RESTORE VERIFYONLY y se restauró con archivos separados. La restauración de referencia pasó DBCC CHECKDB.
- Se validaron las siete huellas SHA-256 del procedimiento. El catálogo de la principal coincidía con la restauración de referencia y con el esquema base del ensayo. El diferencial posterior tuvo las mismas 247 entradas del ensayo.
- Las 31 tablas compartidas conservaron los conteos y las filas proyectadas a sus columnas originales. Entre ellas, Personas conservó 805 filas, EventosEtapa 1490, Solicitudes y Opciones 310 cada una, Reservas y Pagos 124 cada una, y Atenciones 219. Hubo cero filas originales sin coincidencia.
- DBCC CHECKDB de la principal pasó. DBCC CHECKCONSTRAINTS no devolvió infracciones. No se detectaron restricciones deshabilitadas ni no confiables.
- Se comprobaron las ocho medidas M1–M8 y la unicidad de sus granos en la principal. El corte de verificación no tenía conversiones documentadas ni casos resueltos. M1–M8 devolvieron cero y L1–L3 devolvieron NULL.
- La copia restaurada después de instalar pasó las pruebas de conversión idempotente BUYER → LEAD, versiones de propuestas, modificaciones de alternativas, M8 y reportes R1–R3. La prueba se revirtió con rollback. El primer DBCC CHECKDB de esa copia se interrumpió por transacciones diferidas. En una sesión nueva no quedaban transacciones y el control pasó sin reparación.
- El siguiente control operativo es verificar la primera conversión real autorizada. Los datos de prueba se usaron en la copia y el resultado de los KPI de prueba no representa datos de la clínica.

## Paquete para continuar

- [Procedimiento y huellas](PROCEDIMIENTO_INSTALACION_OLTP.md)
- [Punto de entrada BUYER → LEAD](APLICAR_BUYER_LEAD.sql)
- [Verificación de la base instalada](VERIFICAR_OLTP_INSTALADO.sql)
- [Prueba SQL con rollback para copias](PRUEBA_INTEGRACION_LEAD.sql)

Las rutas locales de respaldos y los resultados detallados de la ventana se guardaron fuera del commit. Este paquete cubre la instalación transaccional. Las tareas de las etapas posteriores y del modelo dimensional se coordinan por separado.
