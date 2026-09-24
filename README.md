# NutriHome

NutriHome es una PWA mobile-first que conecta planificaci�n semanal, recetas, objetivos nutricionales, ejercicio, despensa, caducidades y lista de compra. Esta primera iteraci�n ya es funcional sin conexi�n y mantiene separada la l�gica de negocio de la interfaz.

## Funciones implementadas

- Planificaci�n por semanas completas de lunes a domingo, con navegaci�n y generaci�n encadenada de hasta ocho semanas.
- Generaci�n multiobjetivo: equilibrada, r�pida, econ�mica, alta en prote�na, aprovechamiento de despensa, prioridad a caducidades y modo sorpresa.
- Bloqueo, repetici�n e intercambio de comidas, adem�s de un selector tipo Tinder con hasta 100 alternativas compatibles para cada hueco.
- Restricciones diet�ticas reales. Huevo y l�cteos se comprueban de forma independiente a la etiqueta vegetariana.
- Biblioteca de 74 platos base en castellano con 1.717 preparaciones incluidas sus alternativas de ingredientes. Las alternativas se ofrecen aparte de los pasos y no se cuentan como platos diferentes. Los favoritos tienen su propia pesta�a y no alteran el orden del cat�logo.
- El cat�logo contiene 45 platos base compatibles con la dieta vegana, 52 con las dietas lacto y ovo vegetarianas, 63 con la vegetariana, 69 con la pescetariana y 74 con las flexitariana y omn�vora. El objetivo de m�s de 1.000 platos distintos por dieta sigue pendiente; los recuentos anteriores de m�s de 1.000 inclu�an alternativas de ingredientes.
- Cada preparaci�n incorporada tiene ingredientes cuantificados y cuatro pasos; las pruebas rechazan instrucciones gen�ricas, IDs o nombres duplicados.
- Recetas personales con ingredientes escritos libremente: se infieren cantidades y se calculan autom�ticamente coste, calor�as, prote�na, carbohidratos, grasas y fibra.
- Car�tulas �nicas construidas con los ingredientes reales de cada receta sobre vajilla generada con IA, sin mostrar alimentos ajenos; carga opcional de una foto propia persistida en IndexedDB y R2 cuando hay sesi�n.
- Pesta�a independiente de favoritos, asignaci�n directa a un d�a y comida concretos, escalado de raciones, valoraci�n personal e historial de recetas preparadas.
- Despensa con cantidades, unidades, ubicaci�n, stock m�nimo, caducidad, precio registrado y c�digo de barras.
- Descuento FIFO del inventario al preparar una receta y aviso de ingredientes no registrados.
- Lista de compra que agrega ingredientes, normaliza unidades compatibles y resta existencias.
- Productos manuales, marcado comprados, traspaso opcional a despensa y reversi�n coherente al desmarcar.
- Perfil editable, onboarding, objetivos, presupuesto, equipamiento y planificaci�n de ejercicio.
- Calculadora de IMC para adultos con edad, altura y peso corporal, adem�s de contexto sobre sus limitaciones.
- Metas diferenciadas de peso corporal total o masa muscular, sin derivar la masa muscular del IMC.
- Tracker corporal con registros fechados, actualizaci�n por d�a, gr�fica de evoluci�n y masa muscular opcional.
- Estad�sticas semanales, exportaci�n e importaci�n JSON y reinicio/eliminaci�n de datos.
- Persistencia local con IndexedDB, funcionamiento offline y una API de sincronizaci�n autenticada preparada para D1.
- Importador de recetas basado exclusivamente en JSON-LD `Recipe` publicado por la fuente; no elude bloqueos ni hace scraping espec�fico de plataformas.

Las nuevas recetas son redacciones originales de NutriHome inspiradas en t�cnicas culinarias internacionales y en recetarios de dominio p�blico de Project Gutenberg, junto con la colecci�n oficial MyPlate Kitchen del USDA. No se copian textos de libros o p�ginas protegidas. Todos los importes, calor�as y macronutrientes son estimaciones y no sustituyen consejo m�dico o diet�tico profesional.

## Arquitectura

```text
index.html / styles.css     interfaz, accesibilidad y responsive
app.js                      coordinaci�n de vistas y flujos
nutrihome-core.js           unidades, dieta, men�, inventario y compra
demo-data.js                recetas y datos iniciales identificados como demo
recipe-library.js           cat�logo internacional generado, fuentes y perfiles diet�ticos
recipe-estimator.js         inferencia de cantidades, nutrientes y coste orientativo
storage.js                  IndexedDB, im�genes locales y sincronizaci�n progresiva
worker/index.js             assets, API autenticada, R2 e importaci�n JSON-LD
db/schema.ts                esquema l�gico de persistencia
drizzle/                    migraci�n incluida en despliegues
tests/                      l�gica cr�tica y smoke tests PWA
```

El cliente sigue siendo utilizable cuando la API no est� disponible. Con D1 y una identidad de Sites, `/api/state` guarda un snapshot privado por `oai-authenticated-user-id`; el cliente nunca decide la identidad ni recibe secretos. Para hogares compartidos y sincronizaci�n colaborativa en tiempo real har� falta evolucionar este snapshot a entidades relacionales con permisos por hogar.

## Desarrollo local

Requiere Node.js 20 o posterior.

```bash
npm run dev
```

La aplicaci�n queda disponible en `http://127.0.0.1:4173/`.

Las medidas corporales forman parte del estado privado de NutriHome. Se guardan en IndexedDB y, cuando existe una sesi�n autenticada en Sites, se incluyen en el snapshot protegido del usuario en D1.

## Validaci�n

```bash
npm test
npm run check
npm run build
```

Las pruebas cubren conversiones, unidades incompatibles, sin�nimos, dietas y alergias, las 1.717 preparaciones y sus pasos espec�ficos, escalado, resta de despensa, compra neta, generaci�n de 28 comidas, tama�o de la sincronizaci�n, bloqueos y estructura PWA.

## Despliegue

`npm run build` crea:

- `dist/client/` con la PWA est�tica.
- `dist/server/index.js` con el Worker compatible con Cloudflare.
- `dist/.openai/hosting.json` con el proyecto Sites y los bindings l�gicos `DB` y `RECIPE_IMAGES`.

La carpeta `drizzle/` contiene la migraci�n de D1 y se empaqueta al crear una versi�n de Sites. No se necesitan claves en el frontend. Para otro proveedor compatible, configura un binding D1 llamado `DB` y sirve `dist/client` mediante el Worker.

El workflow `.github/workflows/pages.yml` compila `dist/client` y publica esa versi�n est�tica en GitHub Pages. En Pages, la aplicaci�n conserva el guardado local y el modo offline; las rutas de servidor y la sincronizaci�n D1 siguen disponibles �nicamente en el despliegue de Sites.

## Privacidad y seguridad

- IndexedDB se usa como almacenamiento offline, no `localStorage` como fuente de verdad.
- La API rechaza snapshots sin una identidad autenticada del hosting.
- Las escrituras usan sentencias preparadas y el usuario solo puede acceder a su propia fila.
- Se aplican CSP, `nosniff`, pol�tica de referencia y permisos restringidos.
- El importador valida URL, bloquea destinos locales/privados, limita tama�o y tiempo, y solo lee datos estructurados.
- El usuario puede exportar, restaurar y eliminar sus datos locales.

## Pr�ximos bloques

La siguiente evoluci�n l�gica es modelar hogares, miembros y entidades sincronizables por separado para habilitar lista de compra en tiempo real y conflictos offline. Despu�s: esc�ner de c�digos de barras con una API nutricional leg�tima, importaci�n asistida por IA mediante backend, notificaciones push y precios reales solo cuando exista una fuente autorizada.

## Fotograf�as y carga

Cada plato base tiene una imagen WebP individual en `recipe-images/`. `recipe-photos.js` identifica la preparaci�n representada; cuando se selecciona otra variante, la interfaz indica que la foto corresponde a la receta base. No se buscan fotograf�as externas durante la navegaci�n ni se utilizan cuadr�culas o atlas como fondos.

Las fotos se precargan en la cach� de la PWA tras la primera visita. La primera descarga depende de la conexi�n; las aperturas siguientes usan los archivos guardados, mientras el navegador conserve la cach�. El estado local se muestra sin esperar a la sincronizaci�n.

Al a�adir un plato base, a�adir su imagen revisada y ejecutar `node scripts/prepare-recipe-images.mjs`. Las pruebas verifican la correspondencia del cat�logo, los archivos WebP, su tama�o y el funcionamiento de la cach� sin red. La vista local no registra un service worker para evitar cach�s antiguas durante el desarrollo.
