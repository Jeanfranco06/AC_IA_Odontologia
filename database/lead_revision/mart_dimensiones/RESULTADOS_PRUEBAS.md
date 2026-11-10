# Resultados de pruebas de dimensiones LEAD

Las pruebas se ejecutaron en SQL Server sobre restauraciones `COPY_ONLY` con checksum de la OLTP y el Mart. `RESTORE VERIFYONLY` pasó en los dos respaldos. Se restauraron una OLTP de prueba, un Mart de trabajo y un Mart de referencia sin migrar. Los conteos siguientes corresponden a los datos reales de las restauraciones y se tomaron sin los casos sintéticos.

| Dimensión | Existía | Cambios realizados | Origen OLTP | Registros antes | Registros después | Validación |
| --- | --- | --- | --- | ---: | ---: | --- |
| `Dim_Tiempo` | Sí | Índice de fecha y miembro 0. Las 29 fechas fuente ya existían. | Vistas e historiales de solicitudes, propuestas y opciones | 46 | 47 | Fecha única y componentes de calendario correctos. |
| `Dim_Servicio` | Sí | Índice por servicio y miembro 0. Se conservan categoría y procedimiento anteriores. | `Servicios` | 12 | 13 | Los 12 servicios se conciliaron por ID y nombre. |
| `Dim_Canal` | Sí | Índice por canal y miembro 0. Se conserva `TipoMedio`. | `Canales` | 8 | 9 | Los ocho canales se conciliaron por ID y nombre. |
| `Dim_Sede` | Sí | Índice por sede y miembro 0. Se preserva distrito heredado. | `Sedes` | 3 | 4 | Las tres sedes y zonas se conciliaron. El caso sin distrito y zona quedó nulo. |
| `Dim_Negociador` | Sí | Índice por usuario y miembro 0. | `Usuarios` | 4 | 5 | Los cuatro usuarios se conciliaron sin una asignación por defecto. |
| `Dim_Profesional` | Sí | Índice por profesional y miembro 0. | `Profesionales` | 4 | 5 | Cuatro profesionales conciliados. El caso sin especialidad quedó nulo. |
| `Dim_Promocion` | No | Tabla con catálogo, texto documentado y cuatro miembros de control. | `PromocionesLead`, propuestas y su historial | 0 | 4 | Cero promociones operativas. La prueba distinguió catálogo, texto y ausencia de promoción, sin duplicar versiones. |
| `Dim_MotivoRechazo` | No | Tabla con ámbito y categoría separados, más tres miembros de control. | `MotivosRechazoLead` | 0 | 3 | Cero motivos operativos. La prueba verificó económico, incompatibilidad y otros. |
| `Dim_Horario` | No | Tabla por combinación de día, turno e intervalo. Tres miembros de control. | `HistorialOpcionesLead` y `Horarios` | 0 | 10 | Siete combinaciones reales. La prueba conservó el mismo intervalo en dos días, un horario parcial y el rol ofrecido. |

## Controles ejecutados

- **Conciliación.** Pasaron las nueve dimensiones. Los seis catálogos compartidos conservaron las claves sustitutas anteriores. La comparación exacta cubrió 19 objetos. Se conservaron los cinco hechos legados, `Dim_Hora`, las demás dimensiones fuera del alcance y los atributos protegidos de las compartidas.
- **Idempotencia.** Dos reejecuciones posteriores a la carga inicial conservaron las nueve huellas SHA-256 de las filas ordenadas. Se comprobó que los casos sintéticos también se revirtieran.
- **Concurrencia.** Otra sesión sostuvo `ETL_BUYER_SEMANA9` en la OLTP de prueba. El ETL rechazó la carga con 54712 y las huellas de las dimensiones quedaron iguales.
- **Rollback.** Se provocó 54718 después de las escrituras. Volvieron a coincidir las nueve huellas y el control confirmó que los motivos sintéticos no quedaron en la OLTP de prueba.
- **Compatibilidad BUYER.** Pasaron los bloques aislados de tiempo, sede, servicio, canal, profesional y negociador de Daniel, y el bloque dimensional de inversión BUYER. Cada ejecución se revirtió. La prueba confirmó que el bloque de Daniel preserva distrito. No se ejecutaron cargas de hechos.
- **Integridad.** No se detectaron claves foráneas deshabilitadas o no confiables en el Mart de prueba. `DBCC CHECKDB` pasó en esa copia.

El primer ensayo detectó que SQL Server no permitía persistir la expresión de presentación del intervalo y que la variable de validación requería una columna opcional explícita. Se corrigieron ambos puntos y se repitió la suite completa.

La compatibilidad del ETL BUYER completo queda condicionada a su despliegue independiente. La base inspeccionada tiene el hecho BUYER legado y carece de la tabla de inversión. La existencia de esos prerrequisitos no se simuló creando hechos. Los conteos sintéticos no se usaron como resultados de la clínica.
