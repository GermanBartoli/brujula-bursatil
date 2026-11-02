# Brújula Bursátil

Un panel personal para seguir acciones internacionales y CEDEARs, leer sus noticias y registrar una cartera en el navegador.

- Sitio: https://brujula-bursatil.pages.dev
- Repositorio: https://github.com/GermanBartoli/brujula-bursatil
- Autor: German Bartoli. Colaboración: Codex.

## Qué incluye

- Panel adaptable a escritorio y celular, en español.
- Favoritas, listas personalizadas y posiciones con cantidad y costo promedio.
- Búsqueda internacional paginada con Marketaux, catálogo inicial y CEDEARs disponibles en Data912.
- Gráficos interactivos, perfil de empresa y calendario económico de TradingView; enlace a próximos balances.
- Noticias directas o contexto sectorial, agrupación de duplicados y novedades desde la última visita.
- Análisis bajo demanda del título y extracto con Cloudflare Workers AI.
- Vista en USD/ARS, conversión al dólar CCL y resultados estimados.
- Respaldo JSON con exportación, validación e importación confirmada.
- Publicación automática en Cloudflare Pages después de verificar cada push a `main`.

## Tecnología

React, TypeScript, Vite, Tailwind CSS, Lucide y una API en el runtime de Workers mediante el modo avanzado de Pages. No requiere cuentas de usuario ni base de datos de carteras.

## Desarrollo

Requiere Node.js 24 o posterior.

```powershell
npm ci
npm run build
Copy-Item .dev.vars.example .dev.vars
```

Completá `.dev.vars` localmente con las claves de Marketaux. Está excluido de Git. Luego iniciá la API y, en otra terminal, el frontend:

```powershell
npm run preview
```

```powershell
npm run dev
```

La aplicación de desarrollo se abre en `http://127.0.0.1:5173`; Vite redirige `/api` al servidor Pages de `127.0.0.1:8787`. Workers AI requiere conexión a Cloudflare y su binding. El build genera el cliente y `dist/_worker.js`; `_routes.json` dirige únicamente `/api/*` al Worker.

## Secretos y despliegue

Los secretos de GitHub Actions son `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MARKETAUX_API_KEY` y `MARKETAUX_API_KEY_BACKUP`. Nunca se incluyen en el frontend ni en archivos versionados. Las claves de Marketaux también deben estar configuradas como secretos de producción del proyecto Pages. El flujo sincroniza los secretos de Marketaux antes de publicar. No ejecuta despliegues desde pull requests.

Se reutiliza el proyecto `brujula-bursatil`, con rama de producción `main` y binding de Workers AI `AI`. Se eligió Pages porque el token de la cuenta permite gestionar Pages, pero no el despliegue independiente de Workers. No hay una segunda integración Git de Cloudflare: GitHub Actions es la única automatización.

Para desplegar manualmente con el token y cuenta ya configurados en el entorno:

```powershell
npm run deploy
```

## Verificaciones

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas unitarias cubren conversión, cotización del CEDEAR frente a su subyacente, datos faltantes, importación inválida, respaldo de Marketaux por cuota, validación de IA y rechazo de solicitudes incorrectas. Las pruebas de navegador usan respuestas simuladas para no consumir cuotas: comprueban cartera persistente, exportación, navegación móvil, teclado y ausencia de desborde. La disponibilidad real de proveedores se verifica por separado al publicar.

## Datos y límites

| Fuente | Uso | Limitaciones |
| --- | --- | --- |
| [Marketaux](https://www.marketaux.com/documentation) | Entidades, noticias y sentimiento | La búsqueda abarca su cobertura, no garantiza todas las acciones del mundo. Se solicitan hasta tres noticias y quince símbolos por consulta. |
| [TradingView](https://www.tradingview.com/widget-docs/) | Gráficos y calendario | Algunos instrumentos o bolsas no están disponibles en widgets; pueden existir demoras. |
| [Data912](https://data912.apidocs.ar/) | Cotizaciones de EE. UU. y CEDEARs | Servicio educativo, no garantiza datos en tiempo real. Sin cobertura, se muestra el estado correspondiente. |
| [DolarAPI](https://dolarapi.com/) | Referencia CCL | Tipo de cambio indicativo al momento de la consulta. |
| [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) | Resumen y posible impacto | Analiza título y extracto, no el artículo completo. Puede cometer errores. |

El calendario integrado es económico; los balances se consultan mediante enlace a TradingView. No se inventan fechas de balances ni precios. Los CEDEARs se vinculan con las correspondencias de Data912 y una selección inicial verificada. Se incluyen únicamente las especies en pesos identificadas; las variantes D/C en dólares no se confunden con ARS. El símbolo de origen puede corregirse al editar una posición. No se aplican ratios de conversión de títulos.

Las posiciones se valoran con el precio del instrumento y su moneda. Tanto el costo como el valor actual se convierten con el mismo CCL: el resultado no representa la ganancia histórica por tipo de cambio. Las posiciones sin precio o sin conversión quedan excluidas del total y se contabilizan como faltantes. No se calculan comisiones, dividendos, impuestos ni ajustes corporativos.

## Privacidad y protección de cuotas

La cartera, los costos y cantidades se guardan en `localStorage`; no se envían al servidor. Los símbolos consultados sí se envían a la API. Los widgets conectan el navegador con TradingView. Los respaldos contienen datos personales de cartera y no se sincronizan automáticamente entre dispositivos.

La API utiliza caché compartida por centro de datos: cinco minutos para cotizaciones, treinta minutos para noticias y un día para búsquedas y análisis. La segunda clave se utiliza solo ante una respuesta de cuota agotada o límite de consultas, nunca para ocultar credenciales inválidas. Las claves y errores privados del proveedor no se devuelven al navegador.

El análisis acepta únicamente identificadores de noticias previamente consultadas y almacenadas; no permite enviar prompts arbitrarios ni descargar URLs indicadas por el cliente. Tiene límites por IP e instancia. En Pages estos contadores son aproximados y no constituyen una cuota global distribuida. Antes de abrir el servicio a un público amplio, agregar control de acceso, límites globales durables y monitoreo del consumo.

## Próximas ampliaciones

- Proveedor de cotizaciones globales con cobertura y licencias verificadas.
- Calendario de balances por empresa y alertas con fechas reales.
- Catálogo oficial completo de CEDEARs, ratios y eventos corporativos.
- Sincronización opcional entre dispositivos, manteniendo el modo local.
- Rendimiento histórico con tipo de cambio de cada operación.

## Licencia

Código bajo licencia MIT. Las marcas, widgets y datos de terceros conservan sus condiciones de uso.
