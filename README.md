# Marea

Marea es una PWA instalable para registrar el ciclo menstrual de forma privada, personal y probabilística. Funciona sin cuenta, guarda los datos en el dispositivo y puede usarse sin conexión.

## Qué incluye

- Predicción personalizada del próximo periodo, la ovulación posible y las fases con ventana de incertidumbre.
- Calendario interactivo y registro de flujo, ánimo, síntomas, actividad sexual, protección, energía, sueño, LH, PdG, temperatura basal, moco cervical, señales de wearable y notas.
- Estimación probabilística de embarazo tras una relación sin protección o un fallo del método, con intervalo de incertidumbre, nivel de confianza y orientación temporal sobre anticoncepción de emergencia.
- Importación CSV de temperatura nocturna, pulso en reposo, HRV, sueño y biomarcadores.
- Tendencias de duración y señales frecuentes.
- Informe de los últimos registros para compartir con un profesional.
- Recordatorios discretos, exportación e importación de copias, modo oscuro y modo discreto.
- PWA instalable en Android, iPhone y escritorio, con funcionamiento offline.

## Privacidad

No hay cuenta, analítica, publicidad ni servidor de datos. Los registros se guardan en `localStorage` del navegador. Al borrar los datos del sitio o cambiar de dispositivo se pierden, salvo que antes se exporte una copia. Una exportación contiene información de salud sensible y debe guardarse de forma segura.

## Modelo Marea v2

Marea usa un modelo bayesiano multiseñal local inspirado en modelos de estados ocultos. Mantiene una distribución sobre cada posible día de ovulación y la actualiza con:

- un prior jerárquico construido con la mediana, recencia y variabilidad del historial;
- tests de LH y PdG;
- detección robusta de cambios sostenidos en temperatura basal y nocturna;
- moco cervical y sensación vulvar;
- señales auxiliares de pulso en reposo y HRV.

Las temperaturas marcadas como posiblemente alteradas por enfermedad, poco sueño, alcohol, horario o viaje se excluyen de la detección térmica. Las señales indirectas tienen menos peso que LH, PdG y un cambio térmico sostenido. El modelo personaliza también la fase lútea cuando existen ciclos completos con biomarcadores.

La confianza mostrada describe la información disponible y la concentración de la distribución; no es una tasa de precisión clínica. Marea no es un anticonceptivo, una prueba de fertilidad ni un dispositivo médico validado.

### Probabilidad de embarazo

Para una relación vaginal sin protección, Marea integra la distribución multiseñal de ovulación con una curva de fecundabilidad diaria basada en estudios prospectivos. El cálculo se realiza enteramente en el dispositivo y muestra un intervalo, no una cifra pretendidamente exacta. La hora registrada permite identificar con más precisión la ventana temporal de 120 horas para buscar asesoramiento sobre anticoncepción de emergencia.

Una app de calendario no puede confirmar la ovulación. La estimación no debe usarse para decidir si tener relaciones sin protección ni sustituye consejo sanitario. Si la relación fue hace 5 días o menos y no se desea un embarazo, la app recomienda consultar cuanto antes sobre anticoncepción de emergencia.

Fuentes principales: [metaanálisis de wearables y modelos de 2025](https://www.nature.com/articles/s41746-025-02320-8), [modelo HMM multiseñal](https://www.nature.com/articles/s41746-019-0139-4), [temperatura nocturna validada frente a LH](https://pubmed.ncbi.nlm.nih.gov/39881571/), [OMS](https://www.who.int/news-room/fact-sheets/detail/emergency-contraception), [CDC 2024](https://www.cdc.gov/contraception/hcp/usspr/emergency-contraception.html) y [Wilcox et al.](https://pubmed.ncbi.nlm.nih.gov/7477165/).

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
