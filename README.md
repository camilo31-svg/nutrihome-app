# Marea

Marea es una PWA instalable para registrar el ciclo menstrual de forma privada, personal y probabilística. Funciona sin cuenta, guarda los datos en el dispositivo y puede usarse sin conexión.

## Qué incluye

- Predicción personalizada del próximo periodo y de las fases con ventana de incertidumbre.
- Calendario interactivo y registro de flujo, ánimo, síntomas, energía, sueño, temperatura basal, flujo cervical y notas.
- Tendencias de duración y señales frecuentes.
- Informe de los últimos registros para compartir con un profesional.
- Recordatorios discretos, exportación e importación de copias, modo oscuro y modo discreto.
- PWA instalable en Android, iPhone y escritorio, con funcionamiento offline.

## Privacidad

No hay cuenta, analítica, publicidad ni servidor de datos. Los registros se guardan en `localStorage` del navegador. Al borrar los datos del sitio o cambiar de dispositivo se pierden, salvo que antes se exporte una copia. Una exportación contiene información de salud sensible y debe guardarse de forma segura.

## Modelo de predicción

Marea usa un estimador probabilístico local: combina una referencia inicial con la mediana y la media ponderada del historial personal, atenúa posibles valores anómalos, aumenta el peso de ciclos recientes y calcula la ventana a partir de la variabilidad observada. La estimación se actualiza si la fecha prevista pasa sin un nuevo periodo registrado.

Las fases y la ovulación se infieren desde fechas; no se confirman hormonalmente. Marea no es un anticonceptivo, una prueba de fertilidad ni un dispositivo médico.

## Desarrollo local

Requiere Node.js 20 o posterior.

```bash
npm run dev
```

Abre `http://127.0.0.1:4173`.

Para validar y generar la versión de producción:

```bash
npm run check
npm run build
```

## Publicación en GitHub Pages

El contenido estático de la raíz puede publicarse directamente con GitHub Pages. Para conservar la instalación PWA, usa HTTPS y mantén `manifest.webmanifest`, `sw.js` e `icons/` en la misma ruta que `index.html`.

## Aviso sanitario

Marea ofrece información orientativa, no diagnóstico. Ante dolor intenso, sangrado inusual, embarazo posible o cambios persistentes, consulta a un profesional sanitario.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
