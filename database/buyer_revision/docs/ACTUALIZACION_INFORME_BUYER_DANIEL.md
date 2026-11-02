# Actualización del Informe Grupal — Etapa BUYER
**De:** Germain (Integrante 1 — Modelado Dimensional y BI)  
**Para:** Daniel (Integrante 2 — Etapa BUYER)  
**Propósito:** Guía técnica y metodológica con los textos, esquemas y tablas necesarias para actualizar el informe académico grupal (*INforme nexosalud.pdf*) conforme a las observaciones del docente Dr. Ricardo Mendoza Rivera.

> **Revision posterior:** esta propuesta original contiene definiciones que no deben copiarse sin ajustar. Consultar [reglas vigentes y cierre](CIERRE_BUYER_Y_VALIDACION_LOCAL.md): B3 por cohorte se conserva, CPL de campana es descriptivo, impresiones/clics no tienen fuente, el hecho de gastos es transaccional y las cifras son sinteticas.

---

## 1. Contexto del Cambio: ¿Por qué pasamos de 1 a 2 Tablas de Hechos?

En la versión anterior del informe (págs. 19–22) teníamos una sola tabla de hechos (`fact_captacion_buyer`) y habíamos colocado dentro la medida `costo_atribuido_captacion`.

### El problema detectado:
Siguiendo la metodología del docente (**"4.0 Análisis Dimensional — Cuadro Medidas y Dimensiones"**), cada análisis dimensional nace del documento/entidad transaccional donde se origina la información:
1. **La Captación** nace del formulario de registro (`Personas`), cuyo grano es **1 contacto / persona física**.
2. **El Gasto Publicitario** nace de las facturas de pauta en Meta Ads / Google Ads (`GastosCampana`), cuyo grano es **1 inversión por campaña, canal y fecha**.

Un gasto publicitario (ej. S/. 1,500 gastados en Septiembre en WhatsApp Ads) **no tiene persona ni DNI**. El gasto original tiene grano propio. Un costo atribuido por contacto puede coexistir si su regla de reparto esta documentada y concilia; no equivale a la inversion original. Por eso conservamos ambas medidas con significados distintos.

### La solución metodológica:
BUYER se estructura ahora formalmente bajo un esquema de **Constelación de Hechos (Fact Constellation)** con **dos (2) Tablas de Hechos** unidas por dimensiones conformadas.

---

## 2. Sección para el Informe: "Dimensionalización de BUYER"
*(Daniel: sustituir el contenido de las págs. 18–20 del informe con este texto y estructura)*

### 2.1 Modelo Dimensional: Constelación de Hechos de BUYER
Para resolver con rigor metodológico el proceso de captación comercial y la auditoría de inversión publicitaria, el Data Mart de la etapa BUYER implementa dos hechos interrelacionados:

```
                            [DIMENSIONES CONFORMADAS]
                             ┌───────────────────────┐
                             │ • Dim_Tiempo          │
                             │ • Dim_Fuente (Campaña)│
                             │ • Dim_Canal           │
                             └───────────┬───────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
    [TABLA DE HECHOS 1]                             [TABLA DE HECHOS 2]
   fact_captacion_buyer                        fact_inversion_campana_buyer
 (Hecho Central de Contactos)                   (Hecho de Inversión y Pauta)
─────────────────────────────────             ──────────────────────────────────
Grano: 1 contacto individual                  Grano: 1 gasto de campaña por fecha
Medidas:                                      Medidas:
• contacto_registrado                         • monto_inversion (S/.)
• contacto_utilizable                         • (sin metricas de alcance disponibles)
• conversion_lead                             • (alcance pendiente de fuente)
• tiempo_conversion_dia                       Dimensiones adicionales:
Dimensiones adicionales:                       (Solo dimensiones compartidas)
• Dim_Sede, Dim_Servicio,
  Dim_TipoPersona, Dim_EstadoRegistro
```

#### Descripción de las Tablas de Hechos:

1. **`fact_captacion_buyer` (Hecho acumulativo atómico):**
   * **Grano:** Exactamente un registro por cada persona/contacto captado.
   * **Clave Primaria:** `id_persona` (garantiza unicidad física) y clave sustituta `id_captacion`.
   * **Medidas Base:**
     * `contacto_registrado`: Conteo aditivo bruto de prospectos.
     * `contacto_utilizable`: Conteo de prospectos válidos que otorgaron consentimiento conforme a la Ley N.º 29733.
     * `conversion_lead`: Bandera (1 o 0) de avance formal a la etapa LEAD.
     * `tiempo_conversion_dia`: Días transcurridos entre la captación y la conversión.
     * `costo_atribuido_captacion`: Costo asignado por campana/mes, conciliado al centimo; NULL sin evidencia.
   * **Dimensiones asociadas:** `Dim_Tiempo`, `Dim_Sede`, `Dim_Servicio`, `Dim_Canal`, `Dim_Fuente`, `Dim_TipoPersona`, `Dim_EstadoRegistro`.

2. **`fact_inversion_campana_buyer` (Hecho transaccional por registro de gasto):**
   * **Grano:** Un registro por gasto publicitario ejecutado según fecha, campaña y canal.
   * **Clave Primaria:** `id_gasto` (clave natural de `GastosCampana`).
   * **Medidas Base:**
     * `monto_inversion`: Importe financiero real invertido en pauta publicitaria (en Soles S/.).
     * `impresiones` y `clics`: columnas reservadas sin fuente actual; se cargan NULL y no se presentan como medidas disponibles.
   * **Dimensiones asociadas:** `Dim_Tiempo` (fecha del gasto), `Dim_Fuente` (campaña comercial activa) y `Dim_Canal` (medio de difusión: WhatsApp, Instagram, Facebook).

---

## 3. Sección para el Informe: "Indicadores de BUYER"
*(Daniel: actualizar la Tabla 5 del informe en págs. 21–22)*

B3 conserva su definicion por cohorte. El reporte 2 combina agregados de ambas tablas para describir CPL de campana; no sustituye automaticamente el indicador aprobado.

| Código | Nombre del Indicador | Fórmula Matemática Algorítmica | Tablas de Origen (Data Mart) | Dimensiones de Análisis | Umbrales Semafóricos |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **B1** | **Conversión BUYER $\to$ LEAD en $\le$ 14 días** | $\frac{\sum \text{conversion\_lead}_{(\le 14\text{d})}}{\sum \text{contacto\_utilizable}} \times 100$ | `fact_captacion_buyer` | Tiempo, Sede, Servicio, Canal, Fuente, TipoPersona, EstadoRegistro | **Verde:** $\ge 20\%$<br>**Ámbar:** $10\% - 19.9\%$<br>**Rojo:** $< 10\%$ |
| **B2** | **Contactos Utilizables (Calidad y Ley 29733)** | $\frac{\sum \text{contacto\_utilizable}}{\sum \text{contacto\_registrado}} \times 100$ | `fact_captacion_buyer` | Tiempo, Canal, Fuente, TipoPersona, EstadoRegistro | **Verde:** $\ge 80\%$<br>**Ámbar:** $60\% - 79.9\%$<br>**Rojo:** $< 60\%$ |
| **B3** | **Costo por LEAD atribuible a cohorte** | Suma de costo_atribuido_captacion / suma de conversion_lead de la misma cohorte; NULL si falta costo o conversiones | `fact_captacion_buyer` | Dimensiones de captacion; respetar regla de atribucion | Verde <= S/50; ambar > S/50 y <= S/100; rojo > S/100; NULL sin semaforo |

---

## 4. Sección para el Informe: "Reportes de Gestión de BUYER"
*(Daniel: en la pág. 24 del informe actualmente solo está el Reporte 1. Se debe incluir este segundo reporte)*

### Reporte 1: Resumen de Captación de Prospectos *(Existente)*
* **Propósito:** Evaluar el volumen bruto de contactos y prospectos utilizables distribuidos geográficamente en las sedes físicas de la clínica.
* **Filtro (Contexto):** `TIEMPO` (Año y Mes).
* **Filas:** `FUENTE DE ATRACCIÓN` agrupando a `CANAL`.
* **Columnas:** `SEDE FÍSICA` (Sede Centro Histórico, Sede California, No especificada).
* **Medida Principal:** `contacto_registrado` y `contacto_utilizable`.
* **Tabla de Hechos que lo sustenta:** `fact_captacion_buyer`.

---

### Reporte 2: Inversion registrada y CPL de campana *(NUEVO)*
* **Propósito:** Brindar al Directorio Médico y al área de Marketing visibilidad sobre el costo real de adquisición de prospectos, identificando qué campañas y canales publicitarios generan conversiones con menor costo unitario.
* **Filtro (Contexto):** `TIEMPO` (Año y Mes / Histórico).
* **Filas:** `TIPO DE ORIGEN` agrupando a `CAMPAÑA PUBLICITARIA` (ej. *Redes Sociales* $\to$ *Meta Ads - WhatsApp*, *Meta Ads - Instagram*).
* **Columnas:** `CANAL PUBLICITARIO` (WhatsApp, Instagram, Facebook, Página Web).
* **Medidas Principales:**
  1. `monto_inversion`: Inversión publicitaria ejecutada en Soles (S/.).
  2. `conversion_lead`: Conteo de prospectos convertidos a LEAD.
  3. `costo_por_lead (CPL)`: Ratio de eficiencia financiera ($\text{S/.} / \text{Lead}$).
* **Tablas de Hechos que lo sustentan:** Constelación `fact_inversion_campana_buyer` cruzada con `fact_captacion_buyer`.

---

## 5. Datos Reales de Prueba para Incluir en el Informe (Evidencias)

Referencia sintetica del conjunto de pruebas anterior; no es evidencia financiera real ni resultado garantizado de cualquier base. Recalcular y etiquetar como simulado antes de incluir:

| Categoría (Tipo de Origen) | Campaña Publicitaria | Canal | Inversión (S/.) | Contactos | Leads | CPL (S/./Lead) | Referencia de CPL (no B3) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Redes Sociales (Pauta)** | Meta Ads - WhatsApp Primavera | WhatsApp | S/. 1,600.00 | 302 | 251 | **S/. 6.37** | **Verde** ($\le 50$) |
| **Redes Sociales (Pauta)** | Meta Ads - Instagram Primavera | Instagram | S/. 850.00 | 176 | 60 | **S/. 14.17** | **Verde** ($\le 50$) |
| **Redes Sociales (Pauta)** | Meta Ads - Facebook Primavera | Facebook | S/. 450.00 | 115 | 0 | *Sin leads* | **Ámbar / Revisión** |
| **Búsqueda Orgánica** | SEO Orgánico - Página Web | Web | S/. 200.00 | 90 | 0 | *Informativo* | — |
| **Búsqueda Orgánica** | Google Maps Local | WhatsApp | S/. 150.00 | 125 | 0 | *Informativo* | — |
| **Total General** | — | — | **S/. 3,250.00** | **808** | **311** | **S/. 10.45** | **Verde** |

### Interpretación Gerencial para el Informe:
> *"En este conjunto sintetico de prueba, la campaña con mayor rendimiento comercial fue **Meta Ads - WhatsApp Primavera**, logrando 251 conversiones con un Costo por Lead de **S/. 6.37**, ubicándose dentro del rango Verde óptimo (menor a S/. 50). En contraste, la campaña de Facebook Ads generó 115 contactos iniciales pero 0 conversiones a LEAD durante el período evaluado, lo que sugiere reasignar dicho presupuesto hacia WhatsApp e Instagram Ads para optimizar el retorno de la inversión publicitaria."*

---

## 6. Checklist de Secciones a Editar por Daniel

- [ ] **Página 18:** Actualizar el diagrama conceptual E-R / Estrella a **Constelación de Hechos (Fact Constellation)** con las 2 tablas.
- [ ] **Páginas 19–20:** Ajustar las definiciones de grano y medidas de `fact_captacion_buyer` y `fact_inversion_campana_buyer`.
- [ ] **Tabla de indicadores:** conservar B3 por cohorte y explicar por separado el CPL descriptivo del reporte 2; recalcular ratios en cada subtotal/total.
- [ ] **Páginas 24–25:** Agregar la subsección del **Reporte 2** con su diseño matricial (Filas = Campañas, Columnas = Canales, Medidas = Inversión y CPL).
- [ ] **Anexos:** Mencionar el script oficial implementado: `database/buyer_revision/semana9/06_segunda_tabla_hecho_inversion_buyer.sql`.

