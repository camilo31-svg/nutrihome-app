# NutriHome

NutriHome es una PWA mobile-first que conecta planificación semanal, recetas, objetivos nutricionales, ejercicio, despensa, caducidades y lista de compra. Esta primera iteración ya es funcional sin conexión y mantiene separada la lógica de negocio de la interfaz.

## Funciones implementadas

- Planificación por semanas completas de lunes a domingo, con navegación y generación encadenada de hasta ocho semanas.
- Generación multiobjetivo: equilibrada, rápida, económica, alta en proteína, aprovechamiento de despensa, prioridad a caducidades y modo sorpresa.
- Bloqueo, repetición e intercambio de comidas, además de un selector tipo Tinder con hasta 100 alternativas compatibles para cada hueco.
- Restricciones dietéticas reales. Huevo y lácteos se comprueban de forma independiente a la etiqueta vegetariana.
- Biblioteca de 1.705 recetas únicas en castellano, con más de 1.000 opciones compatibles para cada dieta disponible, búsqueda por nombre/ingrediente/etiqueta, filtros dietéticos completos y carga progresiva de resultados.
- Cada receta incorporada tiene ingredientes cuantificados y cuatro pasos propios; las pruebas rechazan instrucciones genéricas, IDs o nombres duplicados y catálogos con menos de 1.000 opciones por dieta.
- Recetas personales con ingredientes escritos libremente: se infieren cantidades y se calculan automáticamente coste, calorías, proteína, carbohidratos, grasas y fibra.
- Carátulas únicas construidas con los ingredientes reales de cada receta sobre vajilla generada con IA, sin mostrar alimentos ajenos; carga opcional de una foto propia persistida en IndexedDB y R2 cuando hay sesión.
- Pestaña independiente de favoritos, asignación directa a un día y comida concretos, escalado de raciones, valoración personal e historial de recetas preparadas.
- Despensa con cantidades, unidades, ubicación, stock mínimo, caducidad, precio registrado y código de barras.
- Descuento FIFO del inventario al preparar una receta y aviso de ingredientes no registrados.
- Lista de compra que agrega ingredientes, normaliza unidades compatibles y resta existencias.
- Productos manuales, marcado comprados, traspaso opcional a despensa y reversión coherente al desmarcar.
- Perfil editable, onboarding, objetivos, presupuesto, equipamiento y planificación de ejercicio.
- Calculadora de IMC para adultos con edad, altura y peso corporal, además de contexto sobre sus limitaciones.
- Metas diferenciadas de peso corporal total o masa muscular, sin derivar la masa muscular del IMC.
- Tracker corporal con registros fechados, actualización por día, gráfica de evolución y masa muscular opcional.
- Estadísticas semanales, exportación e importación JSON y reinicio/eliminación de datos.
- Persistencia local con IndexedDB, funcionamiento offline y una API de sincronización autenticada preparada para D1.
- Importador de recetas basado exclusivamente en JSON-LD `Recipe` publicado por la fuente; no elude bloqueos ni hace scraping específico de plataformas.

Las nuevas recetas son redacciones originales de NutriHome inspiradas en técnicas culinarias internacionales y en recetarios de dominio público de Project Gutenberg, junto con la colección oficial MyPlate Kitchen del USDA. No se copian textos de libros o páginas protegidas. Todos los importes, calorías y macronutrientes son estimaciones y no sustituyen consejo médico o dietético profesional.

## Arquitectura

```text
index.html / styles.css     interfaz, accesibilidad y responsive
app.js                      coordinación de vistas y flujos
nutrihome-core.js           unidades, dieta, menú, inventario y compra
demo-data.js                recetas y datos iniciales identificados como demo
recipe-library.js           catálogo internacional generado, fuentes y perfiles dietéticos
recipe-estimator.js         inferencia de cantidades, nutrientes y coste orientativo
storage.js                  IndexedDB, imágenes locales y sincronización progresiva
worker/index.js             assets, API autenticada, R2 e importación JSON-LD
db/schema.ts                esquema lógico de persistencia
drizzle/                    migración incluida en despliegues
tests/                      lógica crítica y smoke tests PWA
```

El cliente sigue siendo utilizable cuando la API no está disponible. Con D1 y una identidad de Sites, `/api/state` guarda un snapshot privado por `oai-authenticated-user-id`; el cliente nunca decide la identidad ni recibe secretos. Para hogares compartidos y sincronización colaborativa en tiempo real hará falta evolucionar este snapshot a entidades relacionales con permisos por hogar.

## Desarrollo local

Requiere Node.js 20 o posterior.

```bash
npm run dev
```

La aplicación queda disponible en `http://127.0.0.1:4173/`.

Las medidas corporales forman parte del estado privado de NutriHome. Se guardan en IndexedDB y, cuando existe una sesión autenticada en Sites, se incluyen en el snapshot protegido del usuario en D1.

## Validación

```bash
npm test
npm run check
npm run build
```

Las pruebas cubren conversiones, unidades incompatibles, sinónimos, dietas y alergias, las 1.705 recetas y sus pasos específicos, escalado, resta de despensa, compra neta, generación de 28 comidas, tamaño de la sincronización, bloqueos y estructura PWA.

## Despliegue

`npm run build` crea:

- `dist/client/` con la PWA estática.
- `dist/server/index.js` con el Worker compatible con Cloudflare.
- `dist/.openai/hosting.json` con el proyecto Sites y los bindings lógicos `DB` y `RECIPE_IMAGES`.

La carpeta `drizzle/` contiene la migración de D1 y se empaqueta al crear una versión de Sites. No se necesitan claves en el frontend. Para otro proveedor compatible, configura un binding D1 llamado `DB` y sirve `dist/client` mediante el Worker.

El workflow `.github/workflows/pages.yml` compila `dist/client` y publica esa versión estática en GitHub Pages. En Pages, la aplicación conserva el guardado local y el modo offline; las rutas de servidor y la sincronización D1 siguen disponibles únicamente en el despliegue de Sites.

## Privacidad y seguridad

- IndexedDB se usa como almacenamiento offline, no `localStorage` como fuente de verdad.
- La API rechaza snapshots sin una identidad autenticada del hosting.
- Las escrituras usan sentencias preparadas y el usuario solo puede acceder a su propia fila.
- Se aplican CSP, `nosniff`, política de referencia y permisos restringidos.
- El importador valida URL, bloquea destinos locales/privados, limita tamaño y tiempo, y solo lee datos estructurados.
- El usuario puede exportar, restaurar y eliminar sus datos locales.

## Próximos bloques

La siguiente evolución lógica es modelar hogares, miembros y entidades sincronizables por separado para habilitar lista de compra en tiempo real y conflictos offline. Después: escáner de códigos de barras con una API nutricional legítima, importación asistida por IA mediante backend, notificaciones push y precios reales solo cuando exista una fuente autorizada.
