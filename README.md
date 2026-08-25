# Marea

Marea es una PWA instalable para registrar el ciclo menstrual de forma privada, personal y probabilística. Funciona sin cuenta, guarda los datos en el dispositivo y puede usarse sin conexión.

## Qué incluye

- Predicción personalizada del próximo periodo, la ovulación posible y las fases con ventana de incertidumbre.
- Fase reproductiva diaria y gráfico de estradiol, progesterona, LH y FSH como índices relativos ponderados por toda la distribución de ovulación.
- Predicción personal de ánimo y energía que solo activa su componente cíclico tras dos ciclos con cobertura suficiente y si mejora una referencia neutral en validación temporal.
- Calendario interactivo y registro de flujo, ánimo, energía, estrés, sueño, impacto diario, síntomas, alimentación, actividad sexual, protección, LH, PdG, temperatura basal, moco cervical, señales de wearable y notas.
- Estimación probabilística de embarazo tras una relación sin protección o un fallo del método, con intervalo de incertidumbre, nivel de confianza y orientación temporal sobre anticoncepción de emergencia.
- Seguimiento longitudinal de ánimo, energía y duración del ciclo, con alertas prudentes ante patrones persistentes y acceso a la Línea 024 / 112 cuando corresponda.
- Perfil alimentario omnívoro, pescetariano, vegetariano o vegano; alergias e intolerancias separadas, celiaquía como exclusión estricta y avisos al registrar una posible exposición.
- Sugerencias diarias de nutrientes y grupos de alimentos filtradas por dieta y seguridad alimentaria. Se basan en síntomas y suficiencia nutricional, no en promesas de “equilibrar hormonas”.
- Importación CSV de temperatura nocturna, pulso en reposo, HRV, sueño y biomarcadores.
- Tendencias de duración y señales frecuentes.
- Informe de los últimos registros para compartir con un profesional.
- Recordatorios discretos, exportación e importación de copias, modo oscuro y modo discreto.
- PWA instalable en Android, iPhone y escritorio, con funcionamiento offline.

## Privacidad

No hay cuenta, analítica, publicidad ni servidor de datos. Los registros se guardan en `localStorage` del navegador. Al borrar los datos del sitio o cambiar de dispositivo se pierden, salvo que antes se exporte una copia. Una exportación contiene información de salud sensible y debe guardarse de forma segura.

Los recordatorios son locales: el navegador los comprueba mientras Marea está abierta y limita el envío a uno por día. Esta versión estática no usa un servidor push y no promete avisos con la app completamente cerrada.

## Modelo Marea v3

Marea usa un modelo bayesiano multiseñal local inspirado en modelos de estados ocultos. Mantiene una distribución sobre cada posible día de ovulación y la actualiza con:

- un prior jerárquico construido con la mediana, recencia y variabilidad del historial;
- tests de LH y PdG;
- detección robusta de cambios sostenidos en temperatura basal y nocturna;
- moco cervical y sensación vulvar;
- señales auxiliares de pulso en reposo y HRV.

Las temperaturas marcadas como posiblemente alteradas por enfermedad, poco sueño, alcohol, horario o viaje se excluyen de la detección térmica. Las señales indirectas tienen menos peso que LH, PdG y un cambio térmico sostenido. El modelo personaliza también la fase lútea cuando existen ciclos completos con biomarcadores.

La confianza mostrada describe la información disponible y la concentración de la distribución; no es una tasa de precisión clínica. Marea no es un anticonceptivo, una prueba de fertilidad ni un dispositivo médico validado.

### Fase reproductiva y curvas hormonales

La fase diaria se obtiene mezclando estados foliculares, periovulatorios y lúteos sobre toda la distribución posterior del día de ovulación. El gráfico de estradiol, progesterona, LH y FSH usa formas fisiológicas cualitativas alineadas a cada posible ovulación y promedia esas curvas según su probabilidad.

Los resultados son índices relativos de 0 a 100 normalizados por hormona. No son concentraciones séricas o urinarias, no reconstruyen una analítica y las alturas de hormonas diferentes no son comparables. Los wearables no miden hormonas. El modelo se pausa en anticoncepción hormonal, embarazo y posparto, y reduce las afirmaciones en contextos variables.

Fuentes principales: [perfiles séricos diarios de Stricker et al.](https://pubmed.ncbi.nlm.nih.gov/16776638/), [fisiología temporal de Endotext](https://www.ncbi.nlm.nih.gov/books/NBK279054/), [HMM multiseñal de Symul et al.](https://www.nature.com/articles/s41746-019-0139-4) y [dataset mcPHASES 2026](https://www.nature.com/articles/s41597-026-06805-3).

### Ánimo, energía y cambios persistentes

Marea no aplica una plantilla poblacional del tipo “esta fase causa este ánimo”. Para cada variable mantiene una referencia robusta personal, alinea los registros con la distribución incierta de ovulación y evalúa el componente cíclico mediante validación temporal. Solo muestra una dirección personal cuando existen al menos dos ciclos, 14 días distribuidos durante 35 días y el modelo cíclico reduce al menos un 10% el error frente a la referencia neutral. Ese 10% es una regla prudente de producto, no un umbral clínico.

Una anomalía aislada no genera una recomendación médica. Residuales repetidos por debajo de la predicción o referencia personal abren primero un check-in sobre sueño, estrés, dolor, enfermedad o medicación. La app sugiere valoración cuando el ánimo bajo o la pérdida de interés persisten en la mayoría de registros durante unas dos semanas, cuando la energía muy baja se mantiene varias semanas o cuando se repiten cambios de duración del ciclo. Estas son señales para conversar con un profesional, nunca diagnósticos de depresión, PMDD, anemia u otra condición. Si se registra preocupación por autolesión, Marea muestra acceso inmediato al 024 y al 112.

Fuentes principales: [estudio prospectivo de hormonas, ánimo y energía de 2025](https://doi.org/10.1017/S003329172400357X), [diferencias individuales durante el ciclo](https://doi.org/10.1177/2167702616635031), [NICE NG222](https://www.nice.org.uk/guidance/ng222/chapter/recommendations), [NHS sobre fatiga persistente](https://www.nhs.uk/symptoms/tiredness-and-fatigue/) y [Línea 024 del Ministerio de Sanidad](https://www.sanidad.gob.es/linea024/).

### Alimentación y seguridad

Las reglas se aplican en este orden: patrón dietético, alergias y celiaquía como exclusiones estrictas, intolerancias, y finalmente síntomas o necesidades del día. Una intolerancia no se trata como alergia y Marea no inventa una cantidad tolerable. Las recomendaciones evitan suplementos y dosis; en dieta vegana recuerdan planificar una fuente fiable de vitamina B12 y valorar la suplementación con un profesional.

La app no puede inspeccionar ingredientes, cambios de formulación ni contaminación cruzada y nunca etiqueta un alimento como “seguro”. Si un registro coincide con una alergia, muestra los signos de alarma y la indicación de seguir el plan prescrito y llamar al 112 ante una reacción grave.

Fuentes principales: [recomendaciones dietéticas de AESAN](https://www.aesan.gob.es/AECOSAN/docs/documentos/nutricion/RECOMENDACIONES_DIETETICAS.pdf), [alérgenos regulados por la Comisión Europea](https://food.ec.europa.eu/food-safety/campaign-2026/allergies_en), [ACOG sobre síndrome premenstrual](https://www.acog.org/womens-health/faqs/Premenstrual-Syndrome), [NHS sobre alimentación vegana](https://www.nhs.uk/live-well/eat-well/how-to-eat-a-balanced-diet/the-vegan-diet/) y [revisión sistemática de nutrición y síntomas del ciclo](https://doi.org/10.1017/S0954422423000227).

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
