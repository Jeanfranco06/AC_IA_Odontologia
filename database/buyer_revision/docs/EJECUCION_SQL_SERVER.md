# Instalacion y ejecucion SQL Server

[Inicio](../README.md) · [Validacion y resultados](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

El paquete requiere NexoSaludDB y NexoSalud_Mart en la misma instancia SQL Server 2019/2022. Las referencias entre bases usan esos nombres. Detener el backend mientras se instalan estructuras/procedimientos.

## 1. Instalacion nueva

Solo sobre bases nuevas o una copia de pruebas sin las tablas del proyecto. Si ya existen las bases revisadas, seguir la seccion 2. No ejecutar init sobre tablas existentes ni borrar bases por actualizar Git.

### 1.1 Orden completo, con o sin cohorte de 10k

Ejecutar cada archivo/bloque completo antes de pasar al siguiente:

| Orden | Archivo o bloque | Resultado |
|---|---|---|
| 1 | [init_oltp.sql](../semana9/init_oltp.sql) | Crea OLTP, contratos Buyer y conversion operativa. |
| 2 | [init_mart.sql](../semana9/init_mart.sql) | Crea dimensiones y hechos base. |
| 3 | [01_catalogos.sql](../semana9/01_catalogos.sql) | Carga catalogos y datos sinteticos originales de todas las fases. Es requisito del escenario 10k; no es un archivo de solo catalogos. |
| 4 | **Solo bloque 1** de [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) | Instala y ejecuta usp_SincronizarCaptacionBuyer. Incluir CREATE OR ALTER, GO y EXEC final, hasta antes del bloque 2. |
| 5 | [06_segunda_tabla_hecho_inversion_buyer.sql](../semana9/06_segunda_tabla_hecho_inversion_buyer.sql), completo | Crea segundo hecho, instala procedimiento y carga inversion existente. |
| 6 | Opcional: [08_poblamiento_buyer_10k.sql](../semana9/simulacion/08_poblamiento_buyer_10k.sql), completo | Agrega 10k, gastos y 2550 solicitudes/eventos; sincroniza ambos hechos Buyer. |
| 7 | **Solo bloque 2** de [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql) | Carga LEAD/PAYER/CUSTOMER/TURNED heredados, incluyendo las solicitudes nuevas. |
| 8 | Si se uso 08: [09_validacion_buyer_10k.sql](../semana9/simulacion/09_validacion_buyer_10k.sql) | Verifica la cohorte V1 inicial; debe terminar con OK. |
| 9 | [02_validacion.sql](../semana9/02_validacion.sql) | Conciliacion global entre fuentes y hechos. |
| 10 | [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql) | Indicadores del historico completo; no filtra exclusivamente V1. |

Si se omite 08, omitir tambien 09. Para pruebas 10k leer antes [su guia](POBLAMIENTO_BUYER_10K.md). Las semillas de pruebas/ no pertenecen a esta secuencia. No hace falta ejecutar 05 de Germain ni la semilla de inversion para que V1 tenga costo.

El 06 no inserta gastos de ejemplo. El 08 si registra gastos **simulados identificados**, sin alterar la regla NULL del modelo.

## 2. Bases revisadas existentes

No repetir init_oltp, init_mart, catalogos ni migracion.

1. Para actualizar la rutina de captacion, ejecutar **el bloque 1 completo** de poblamiento_merge_mart, incluidos CREATE OR ALTER PROCEDURE, GO y EXEC final.
2. Ejecutar el 06 completo para actualizar inversion.
3. Ejecutar el bloque 2 solo si hay que recargar las otras fases. Una solicitud nueva de Buyer no aparece en el hecho LEAD hasta cargarlo.
4. Conciliar con 02 y consultar 03. Los casos detallados estan en la guia de validacion.

## 3. Esquema original de Semana 9

[migracion_buyer.sql](../semana9/migracion_buyer.sql) es una alternativa a la creacion nueva, exclusivamente para una copia del esquema original de Semana 9. Conserva el hecho anterior como legacy y adapta Buyer; no es una migracion universal del esquema PascalCase de main ni de PostgreSQL. Despues cargar el ETL y el 06. Verificar compatibilidad antes de ejecutarla. La ruta comprobada por Daniel fue la instalacion desde cero, no una prueba integral de todas las migraciones posibles.

## 4. Backend y CLI

En `backend/`, configurar .env usando [.env.example](../../../backend/.env.example), con SQLSERVER_URL y las conexiones OLTP/Mart de la instancia local. Para pruebas mantener DUNNING_ENABLED=false. .env no se sube a Git.

```bash
npm ci
npm run prisma:generate
npm run dev
```

El generador Prisma no migra la BD. No ejecutar db push ni migraciones generadas sin revisar el impacto sobre las tablas y procedimientos existentes.

Con procedimientos instalados, la carga Buyer puede ejecutarse por POST `/api/reports/sync` o desde backend mediante:

```bash
npm run etl:buyer
```

Ambas rutas usan la misma sincronizacion. El CLI no instala DDL ni ejecuta el bloque de otras fases. Su nueva envoltura fue compilada; una conexion local sigue siendo necesaria para ejecutarla.

## 5. Separacion de pruebas

Los archivos de [pruebas/](../semana9/pruebas/) son opcionales y no se ejecutan como parte de la instalacion. El 05 deja personas/solicitudes/gastos sinteticos identificados. Las pruebas 06 de confiabilidad y 07 de rollback revierten sus cambios; los contadores IDENTITY pueden conservar saltos. Leer encabezados y ejecutar solo en copia de pruebas.

## 6. Escenario ampliado opcional

Para agregar 10 000 buyers con costos verificables y conversiones historicas, seguir [Poblamiento Buyer 10k](POBLAMIENTO_BUYER_10K.md). Es una cohorte adicional aislada por campanas y emails; conserva el historico. No cambia la instalacion normal ni sustituye las pruebas de concurrencia.

## 7. Orden para continuar otra fase en bases ya instaladas

### 7.1 Obtener la base compartida

Crear una rama propia desde el HEAD de Buyer siguiendo [Entrega a LEAD](ENTREGA_A_LEAD.md). Si la rama ya existe, hacer merge revisado de origin/analysis/buyer-bases-datos. Git actualiza archivos; no crea tablas ni copia datos a SQL Server.

### 7.2 Elegir segun el estado local

| Estado local | Pasos en orden |
|---|---|
| Bases revisadas, procedimientos actuales y V1 ya validada | No repetir init, catalogos ni 08. Ejecutar bloque 2 si faltan las solicitudes V1 en el Mart heredado; despues 02 y 09 antes de editar datos del escenario. |
| Bases revisadas, sin V1 | Actualizar bloque 1 y 06 si sus rutinas estan antiguas; despues 08, bloque 2, 09 y 02. |
| Sin bases/tablas | Seccion 1.1 completa. |
| Esquema original Semana 9 | Seccion 3, en copia y previa comprobacion de compatibilidad; no aplicar la migracion como parche universal. |
| Nuevas migraciones del equipo de fase | Primero obtener baseline validada; luego su migracion OLTP, migracion Mart, rutina ETL, carga y validacion propia, en el orden que documente ese equipo. Estos archivos aun no estan implementados en Buyer. |

No volver a ejecutar una seccion heredada sobre un hecho reemplazado por el nuevo ETL de fase. El equipo debe retirar/coordinadamente sustituir esa seccion, como explica [Entrega a LEAD](ENTREGA_A_LEAD.md#5-evitar-dos-cargas-lead-incompatibles).

### 7.3 Diferenciar carga operativa y carga analitica

08 crea personas, captaciones, solicitudes y eventos historicos. No crea pagos, citas ni seguimientos para los 10k. Bloque 2 alimenta los cuatro hechos heredados; POST /api/reports/sync y npm run etl:buyer sincronizan **solo Buyer**, no esas fases. El numero de filas de un hecho agregado no equivale al numero de operaciones: comparar SUM de medidas, no COUNT(*) del estado de tablas.

### 7.4 Encender y comprobar el sistema

1. Finalizar DDL y cargas SQL con el backend detenido. Configurar [backend/.env.example](../../../backend/.env.example) como backend/.env en la instancia local, manteniendo DUNNING_ENABLED=false. No subir credenciales.
2. Desde backend: npm ci, npm run prisma:generate y npm run dev, en ese orden. Si solo se actualizan archivos .md no hace falta reiniciar ni instalar. Si no cambian dependencias ni Prisma, tampoco hace falta regenerarlos por cada cambio de codigo.
3. Desde raiz, en otra terminal: npm ci y npm run dev. Abrir la URL que indique Vite. [Cliente de reportes](../../../src/shared/services/report.service.ts) usa VITE_API_URL o http://localhost:3001/api; [servicio LEAD](../../../src/modules/lead/services/lead.service.ts) contempla modo alternativo. Para validar contra SQL, comprobar solicitudes de red exitosas y evitar usar datos de fallback/local como evidencia SQL.
4. Consultar http://localhost:3001/api/ping y http://localhost:3001/api/reports/status. Revisar registros/logs sin confundir filas agregadas con solicitudes.
5. Probar primero lectura de la fase y compararla con SQL; despues probar escrituras sobre casos aislados y verificar OLTP, evento, ETL y reporte. [Mapa y controles LEAD](ENTREGA_A_LEAD.md#9-integracion-con-el-sistema).
6. Antes de entregar: npm test y npm run build desde raiz; npm run prisma:generate y npm run build desde backend si cambia su esquema/codigo. Aportar tambien pruebas SQL reales: compilaciones y mocks no prueban conexion ni reglas en SQL Server.

Estas instrucciones no implican que las pantallas operativas de todas las fases ya esten certificadas con el esquema revisado. PostgreSQL y agentes se mantienen fuera de este orden de implementacion.
