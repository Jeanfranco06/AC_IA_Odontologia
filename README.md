# NexoSalud

> **Entrega Buyer validada:** scripts, instalacion, evidencias y limites en [database/buyer_revision](database/buyer_revision/README.md). El equipo LEAD puede crear su propia rama desde `analysis/buyer-bases-datos` siguiendo [la guia de entrega](database/buyer_revision/docs/ENTREGA_A_LEAD.md). Los SQL anteriores estan separados en `database/legacy_pre_buyer/` y no corresponden al esquema vigente.

**NexoSalud** es una aplicación web empresarial orientada a gestionar el recorrido comercial, clínico y operativo de un paciente interesado en servicios odontológicos privados.

Esta rama contiene frontend React y backend Express/Prisma con SQL Server. La conexion OLTP, la sincronizacion de los dos hechos Buyer y sus reportes fueron comprobados localmente por Daniel. Subsisten componentes del prototipo original; la validacion de Buyer no certifica automaticamente las operaciones ni los indicadores de las otras fases.

## Alcance del Proyecto

La aplicación abarca cinco módulos correspondientes a las fases del embudo de conversión y atención:

1. **BUYER:** Registro inicial de interesados, captación y medios de contacto.
2. **LEAD:** Espacio de negociación, propuestas de alternativas (Sede, Profesional, Fecha, Precio) y selección.
3. **PAYER:** Validación de pagos (con comprobante simulado), gestión de rechazos/reversiones e incidencias de cobro.
4. **CUSTOMER:** Ejecución de la cita odontológica, registro clínico (motivo de consulta, evaluación, procedimiento, indicaciones) e incidencias clínicas.
5. **TURNED:** Postventa, medición de satisfacción, seguimientos iterativos y la capacidad de iniciar una **nueva solicitud** reactivando a la persona como un nuevo *Buyer* sin perder el historial.

Además, cuenta con un sistema de **Indicadores en Tiempo Real** para cada módulo y un **Journey Stepper** interactivo en las vistas de detalle que ilustra la trazabilidad del paciente.

## Stack Tecnológico

- **Framework:** React 18
- **Build Tool:** Vite
- **Lenguaje:** TypeScript (Strict Mode)
- **Estilos:** Tailwind CSS
- **Componentes:** shadcn/ui (Radix UI)
- **Manejo de Estado (Servidor/Asíncrono):** TanStack Query (React Query)
- **Enrutamiento:** React Router (v6)
- **Formularios:** React Hook Form + Zod
- **Manejo de Fechas:** date-fns
- **Iconos:** Lucide React
- **Pruebas:** Vitest + React Testing Library

## Arquitectura y Estructura

Se utilizó una adaptación de **Clean Architecture**, dividiendo el código por módulos y responsabilidades:

```text
src/
├── application/       # Lógica de aplicación (Casos de Uso) orquestando entidades y repositorios.
├── domain/            # Reglas de negocio puras, entidades (types/interfaces), enums e indicadores matemáticos.
├── infrastructure/    # Adaptadores externos, patrón Repository que envuelve `localStorage`.
├── modules/           # Agrupación por dominio funcional (buyer, lead, payer, customer, turned).
│   └── [module]/
│       ├── components/# Componentes UI específicos del módulo.
│       ├── hooks/     # Custom hooks de React Query que interactúan con `application`.
│       ├── pages/     # Vistas principales (Listado y Detalle).
│       └── schemas/   # Esquemas de validación Zod.
├── shared/            # Componentes reutilizables, layouts, constantes y utilidades.
└── tests/             # Pruebas unitarias y de integración end-to-end.
```

## Instalación y Ejecución

1. Asegúrate de tener **Node.js** (v18+ recomendado) instalado.
2. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```
3. Levanta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Accede en el navegador a `http://localhost:5173`.

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo.
- `npm run build`: Compila el proyecto con TypeScript y Vite.
- `npm run lint`: Analiza el código con ESLint en busca de errores.
- `npm run test`: Ejecuta toda la suite de pruebas unitarias y de integración usando Vitest.

## Uso de Datos Demostrativos y Reinicio

El sistema persiste todos los registros, transacciones y el *Customer Journey* en el `localStorage` del navegador. 
Al ser un entorno de almacenamiento asíncrono simulado:

- **Los datos permanecerán** aun cuando recargues la página o cierres el navegador.
- **Para reiniciar la base de datos:** Simplemente borra los datos del sitio en tu navegador (Ej: en Chrome, abre DevTools <kbd>F12</kbd> -> pestaña *Application* -> *Local Storage* -> Clic derecho -> *Clear*), y luego recarga la página.

## Flujo Funcional (E2E)

1. **Creación:** En `/buyer`, haz clic en "Registrar BUYER" y llena los datos con una solicitud concreta.
2. **Conversión a LEAD:** Entra al detalle del Buyer y usa la acción "Convertir a LEAD".
3. **Negociación:** En `/lead`, propone una o más alternativas y elige una de ellas para generar una solicitud de pago.
4. **Pago:** En `/payer`, simula el registro de una transferencia con un archivo, valida el pago, y luego conviértelo a CUSTOMER.
5. **Atención Clínica:** En `/customer`, confirma la asistencia, inicia la atención, llena la historia clínica y finaliza la atención. Conviértelo a TURNED.
6. **Postventa:** En `/turned`, verifica o añade seguimientos. Puedes registrar una "Nueva Solicitud" para reiniciar el embudo.

## Pruebas

El sistema incluye pruebas completas que garantizan el flujo de información y validación del dominio:
- `buyer.test.ts`, `lead.test.ts`, `payer.test.ts`, `customer.test.ts`, `turned.test.ts`: Prueban individualmente las validaciones de dominio y transiciones.
- `indicators.test.ts`: Comprueba la precisión matemática y manejo de umbrales / divisiones por cero.
- `integration.test.ts`: Simula el viaje E2E y reactivación, con **39 aserciones**, previniendo conversiones duplicadas y validando la trazabilidad.

## Limitaciones Actuales

- **Autenticación y Seguridad:** El sistema no incluye login ni roles (RBAC) porque se ha centrado en los flujos operativos.
- **Agentes Visuales:** Los "Agentes Simulados" de cobro y postventa en las vistas de detalle son *placeholders* estáticos que comunican el estado. No incluyen inteligencia artificial conversacional real.
- **Archivos Subidos:** Los comprobantes de pago subidos validan su tipo y peso (máx 5MB) en el navegador, pero solo se almacenan sus **metadatos** (nombre, tipo y peso) en el `localStorage`.
- **Dashboards:** No hay un panel gráfico (gráficas de barras/pie), sino tarjetas de KPI directamente en los encabezados de los listados de cada módulo.

## Guía para migración futura (Reemplazar LocalStorage por API)

La aplicación fue diseñada para facilitar la migración hacia un Backend real. 
Dado que toda la persistencia se invoca a través de clases *Use Cases* (`src/application/use-cases`) que se comunican con `LocalRepository`:

1. Se debe crear una nueva clase implementando la misma interfaz del repositorio (ej. `ApiRepository<T>`), usando `fetch` o `axios`.
2. Intercambiar la instanciación de `LocalRepository` en las clases de *Use Cases* por tu nuevo `ApiRepository`.
3. Todos los Hooks (React Query) de las páginas seguirán consumiendo los `useCases` sin enterarse de que la persistencia ahora es remota.
4. Eliminar el uso de generadores de UUID locales y confiar en las llaves primarias proporcionadas por la base de datos backend.
