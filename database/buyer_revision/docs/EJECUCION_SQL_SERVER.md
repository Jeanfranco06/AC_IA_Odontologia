# Instalacion y ejecucion SQL Server

[Inicio](../README.md) · [Validacion y resultados](CIERRE_BUYER_Y_VALIDACION_LOCAL.md).

El paquete requiere NexoSaludDB y NexoSalud_Mart en la misma instancia SQL Server 2019/2022. Las referencias entre bases usan esos nombres. Detener el backend mientras se instalan estructuras/procedimientos.

## 1. Instalacion nueva

Solo sobre bases nuevas o copia de pruebas, ejecutar en este orden desde `semana9/`:

1. [init_oltp.sql](../semana9/init_oltp.sql).
2. [init_mart.sql](../semana9/init_mart.sql).
3. [01_catalogos.sql](../semana9/01_catalogos.sql), si se necesita el conjunto sintetico de demostracion.
4. [poblamiento_merge_mart.sql](../semana9/poblamiento_merge_mart.sql), completo: bloque 1 Buyer y bloque 2 otras fases.
5. [06_segunda_tabla_hecho_inversion_buyer.sql](../semana9/06_segunda_tabla_hecho_inversion_buyer.sql).
6. [02_validacion.sql](../semana9/02_validacion.sql) y [03_indicadores_y_reporte_buyer.sql](../semana9/03_indicadores_y_reporte_buyer.sql).

El 06 crea el segundo hecho Buyer y su procedimiento. No es necesario ejecutar semillas monetarias para instalar. No confundir un origen sin gastos con gasto cero.

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
