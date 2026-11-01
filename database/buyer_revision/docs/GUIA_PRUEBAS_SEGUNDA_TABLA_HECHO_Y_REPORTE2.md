# Guía de Pruebas: Segunda Tabla de Hechos y Reporte 2 (BUYER)

**Proyecto:** NexoSalud — Inteligencia de Negocios  
**Fase:** BUYER (Etapa 01 de Captación)  
**Autor:** Germain (Integrante 1 — Modelado Dimensional y BI)  
**Objetivo:** Validar la implementación de la constelación de hechos (`fact_captacion_buyer` + `fact_inversion_campana_buyer`) y la visualización del **Reporte 2** (*Rendimiento y Eficiencia de Inversión Publicitaria / CPL*).

---

## 1. Verificación en SQL Server (Base de Datos)

El script SQL que crea la tabla, puebla los datos iniciales y valida los cálculos ya está disponible en:  
`database/buyer_revision/semana9/06_segunda_tabla_hecho_inversion_buyer.sql`

### Opción A: Desde Terminal (sqlcmd)
Ejecuta el siguiente comando desde la raíz del proyecto:
```bash
sqlcmd -S localhost -E -i "database\buyer_revision\semana9\06_segunda_tabla_hecho_inversion_buyer.sql"
```

### Opción B: Desde SQL Server Management Studio (SSMS)
1. Abre SSMS y conéctate a tu instancia local (`localhost`).
2. Abre el archivo `06_segunda_tabla_hecho_inversion_buyer.sql`.
3. Pulsa **Execute (F5)**.

### Consultas Rápidas de Comprobación en SSMS
Para verificar las dos tablas de hechos y el Reporte 2 en `NexoSalud_Mart`:

```sql
USE NexoSalud_Mart;
GO

-- 1. Verificar registros en la 2da tabla de hechos
SELECT COUNT(*) AS total_gastos, SUM(monto_inversion) AS inversion_total
FROM dbo.fact_inversion_campana_buyer;

-- 2. Reporte 2: Matriz Inversión por Campaña y Canal Publicitario
SELECT 
    f.TipoOrigen AS categoria,
    f.Campana AS campana,
    c.NombreCanal AS canal,
    SUM(fi.monto_inversion) AS inversion_soles
FROM dbo.fact_inversion_campana_buyer fi
JOIN dbo.Dim_Fuente f ON f.KeyFuente = fi.KeyFuente
JOIN dbo.Dim_Canal c ON c.KeyCanal = fi.KeyCanal
GROUP BY f.TipoOrigen, f.Campana, c.NombreCanal;

-- 3. Cálculo del KPI B3 (Costo por LEAD cruzando ambas tablas)
;WITH Inv AS (
    SELECT KeyFuente, KeyCanal, SUM(monto_inversion) AS inversion
    FROM dbo.fact_inversion_campana_buyer GROUP BY KeyFuente, KeyCanal
),
Leads AS (
    SELECT KeyFuente, KeyCanal, SUM(conversion_lead) AS leads
    FROM dbo.fact_captacion_buyer GROUP BY KeyFuente, KeyCanal
)
SELECT 
    f.Campana, c.NombreCanal,
    Inv.inversion AS [Inversión (S/.)],
    ISNULL(Leads.leads, 0) AS [Leads Generados],
    ROUND(Inv.inversion / NULLIF(Leads.leads, 0), 2) AS [CPL (S/.)]
FROM Inv
JOIN Leads ON Leads.KeyFuente = Inv.KeyFuente AND Leads.KeyCanal = Inv.KeyCanal
JOIN dbo.Dim_Fuente f ON f.KeyFuente = Inv.KeyFuente
JOIN dbo.Dim_Canal c ON c.KeyCanal = Inv.KeyCanal;
```

---

## 2. Verificación en el Backend (API REST)

### Paso 2.1: Iniciar el Backend
En una terminal:
```bash
cd backend
npm run dev
```
*(Debe iniciar en `http://localhost:3001` y confirmar la conexión a `NexoSalud_Mart`)*.

### Paso 2.2: Probar Endpoints en el Navegador o Postman

1. **Auditoría de Tablas en el Data Mart:**  
   Abre en tu navegador:  
   `http://localhost:3001/api/reports/status`  
   *Resultado esperado:* Verás `Fact_CaptacionBuyer` (808 filas) y `Fact_InversionCampanaBuyer` (7 filas).

2. **Reporte 2 (Inversión en Pauta):**  
   Abre:  
   `http://localhost:3001/api/reports/executive/buyer?measure=monto_inversion`  
   *Resultado esperado:* JSON con la matriz de campañas en filas y canales en columnas, totalizando **S/. 3,250.00**.

3. **Reporte 2 (Costo por LEAD / CPL):**  
   Abre:  
   `http://localhost:3001/api/reports/executive/buyer?measure=costo_por_lead`  
   *Resultado esperado:* Matriz calculada donde WhatsApp muestra **S/. 6.37** e Instagram muestra **S/. 14.17**.

4. **Endpoint Directo de Campañas:**  
   Abre:  
   `http://localhost:3001/api/reports/buyer-campaigns`

---

## 3. Verificación en el Frontend (Interfaz de Usuario)

### Paso 3.1: Iniciar el Frontend
En otra terminal (en la raíz del proyecto):
```bash
npm run dev
```
*(Abre la URL indicada, típicamente `http://localhost:5173`)*.

### Paso 3.2: Navegación y Pruebas Visuales
1. En el menú lateral izquierdo, haz clic en **Reportes Ejecutivos**.
2. En la barra superior de pestañas, selecciona la etapa **01 Captación**.
3. En la esquina superior derecha de la tabla matricial, abre el selector desplegable **Indicador / Medida**.
4. Ahora verás las nuevas opciones correspondientes al **Reporte 2**:
   * **Reporte 2: Inversión en Pauta (S/.)**:  
     La tabla pivotea automáticamente a la estructura de Campañas publicitarias vs. Canales, mostrando los subtotales de *Redes Sociales* y *Búsqueda Orgánica*.
   * **Reporte 2: Costo por Lead / CPL (S/.)**:  
     Muestra el costo unitario por cada prospecto calificado a LEAD.
5. Si vuelves a seleccionar `contacto_registrado` o `conversion_lead`, la tabla vuelve inmediatamente al **Reporte 1** (Fuente/Canal vs. Sedes físicas).

---

## 4. Tabla de Resultados Esperados para Validación Rápida

| Métrica Seleccionada | Reporte Activo | Eje de Filas | Eje de Columnas | Total General Esperado |
| :--- | :---: | :---: | :---: | :---: |
| `contacto_registrado` | **Reporte 1** (Captación) | Fuente / Canal | Sedes Físicas | **808** contactos |
| `conversion_lead` | **Reporte 1** (Captación) | Fuente / Canal | Sedes Físicas | **311** leads |
| `monto_inversion` | **Reporte 2** (Inversión) | Tipo Origen / Campaña | Canales Publicitarios | **S/. 3,250.00** |
| `costo_por_lead` | **Reporte 2** (CPL) | Tipo Origen / Campaña | Canales Publicitarios | WhatsApp: **S/. 6.37**<br>Instagram: **S/. 14.17** |

---

## 5. Resumen de Archivos Modificados / Creados

* `database/buyer_revision/semana9/06_segunda_tabla_hecho_inversion_buyer.sql` *(Script SQL DDL, ETL y queries de validación)*
* `backend/src/services/martSyncService.ts` *(Método `syncInversionCampanaBuyer` y llamada en `syncBuyer`)*
* `backend/src/routes/report.routes.ts` *(Función `getBuyerCampaignMatrix`, enrutamiento dinámico y endpoint `/buyer-campaigns`)*
* `src/modules/reports/config/stages.ts` *(Adición de medidas del Reporte 2 en la configuración visual de BUYER)*

