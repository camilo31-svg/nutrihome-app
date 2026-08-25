(() => {
  'use strict';

  const STORAGE_KEY = 'marea:data:v1';
  const DAY_MS = 86400000;
  const today = startOfDay(new Date());
  let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  let selectedDate = dateKey(today);
  let deferredInstallPrompt = null;
  let toastTimer;
  const modelCache = new Map();
  let wellbeingCache = null;

  const symptomLabels = {
    cramps: 'Calambres', headache: 'Dolor de cabeza', bloating: 'Hinchazón',
    tenderness: 'Pecho sensible', acne: 'Piel / acné', backache: 'Dolor lumbar',
    fatigue: 'Cansancio', cravings: 'Antojos', insomnia: 'Sueño irregular', nausea: 'Náuseas'
  };
  const moodLabels = { great: 'Genial', calm: 'En calma', sensitive: 'Sensible', low: 'Ánimo bajo', irritable: 'Irritable' };
  const moodScores = { low: 1.4, irritable: 2.2, sensitive: 2.7, calm: 3.8, great: 4.7 };
  const flowLabels = { none: 'Sin flujo', spotting: 'Manchado', light: 'Ligero', medium: 'Medio', heavy: 'Abundante' };
  const sexualActivityLabels = { none: 'Sin actividad', protected: 'Con protección', unprotected: 'Sin protección o fallo' };
  const protectionLabels = { condom: 'Preservativo', pill: 'Píldora', iud: 'DIU', implant: 'Implante', 'ring-patch': 'Anillo o parche', injection: 'Inyección', other: 'Otro método' };
  const emergencyLabels = { none: 'No / sin registrar', levonorgestrel: 'Levonorgestrel', ulipristal: 'Ulipristal', 'copper-iud': 'DIU de cobre' };
  const lhLabels = { negative: 'LH negativo', positive: 'LH positivo', peak: 'Pico de LH' };
  const pdgLabels = { negative: 'PdG negativo', positive: 'PdG positivo' };
  const modelSignalLabels = { lh: 'LH', pdg: 'PdG', bbt: 'Temperatura basal', wrist: 'Temperatura nocturna', mucus: 'Moco cervical', vitals: 'Pulso / HRV' };
  const hormoneLabels = { estradiol: 'Estradiol', progesterone: 'Progesterona', lh: 'LH', fsh: 'FSH' };
  const hormoneColors = { estradiol: '#b44e69', progesterone: '#718e54', lh: '#b98535', fsh: '#6a6aaa' };
  const dietLabels = {
    omnivore: 'omnívora', pescatarian: 'pescetariana', vegetarian: 'ovolactovegetariana',
    'lacto-vegetarian': 'lactovegetariana', 'ovo-vegetarian': 'ovovegetariana', vegan: 'vegana'
  };
  const foodLabels = {
    vegetables: 'verduras', fruit: 'fruta', legumes: 'legumbres', wholegrains: 'cereales integrales', meat: 'carne',
    fish: 'pescado', milk: 'leche o lácteos', egg: 'huevo', soy: 'soja', gluten: 'gluten', peanut: 'cacahuete',
    nuts: 'frutos de cáscara', sesame: 'sésamo', crustaceans: 'crustáceos', molluscs: 'moluscos', celery: 'apio',
    mustard: 'mostaza', sulphites: 'sulfitos', lupin: 'altramuz', unknown: 'ingredientes desconocidos'
  };
  const phaseMeta = {
    menstrual: { label: 'Menstrual', className: 'menstrual', copy: 'Se estima el inicio de un nuevo ciclo; registra el flujo para confirmarlo.' },
    follicular: { label: 'Fase folicular', className: 'follicular', copy: 'El estradiol suele ascender gradualmente mientras se aproxima la ventana fértil.' },
    fertile: { label: 'Ventana fértil estimada', className: 'fertile', copy: 'Esta ventana es una estimación estadística, no una confirmación de ovulación.' },
    ovulation: { label: 'Ovulación estimada', className: 'ovulation', copy: 'Día de ovulación más probable dentro de una ventana variable.' },
    luteal: { label: 'Fase lútea', className: 'luteal', copy: 'La progesterona suele predominar tras la ovulación y descender antes del siguiente periodo.' },
    uncertain: { label: 'Fase incierta', className: 'tracking', copy: 'El ciclo ha superado su ventana prevista o el contexto es muy variable; Marea no inventará un nuevo inicio.' },
    tracking: { label: 'Seguimiento', className: 'tracking', copy: 'En tu contexto actual mostramos registros y tendencias, sin asignar fases hormonales.' }
  };

  const defaultState = {
    version: 3,
    profile: { configured: false, averageCycle: 29, periodLength: 5, context: 'natural', cyclePattern: 'auto' },
    nutrition: { configured: false, dietType: 'omnivore', allergies: [], allergyOther: '', intolerances: [], intoleranceOther: '', celiac: false },
    periodStarts: [],
    logs: {},
    settings: {
      theme: 'system', discreet: false,
      reminders: { daily: false, biomarkers: false, period: false, fertile: false, health: false, time: '20:30' }
    },
    notificationHistory: {}
  };

  let state = loadState();

  function normalizeNutrition(savedNutrition = {}) {
    const merged = { ...defaultState.nutrition, ...(savedNutrition && typeof savedNutrition === 'object' ? savedNutrition : {}) };
    return {
      ...merged,
      configured: Boolean(merged.configured),
      dietType: dietLabels[merged.dietType] ? merged.dietType : 'omnivore',
      allergies: Array.isArray(merged.allergies) ? merged.allergies.map(String) : [],
      allergyOther: String(merged.allergyOther || ''),
      intolerances: Array.isArray(merged.intolerances) ? merged.intolerances.map(String) : [],
      intoleranceOther: String(merged.intoleranceOther || ''),
      celiac: Boolean(merged.celiac)
    };
  }

  function normalizeLogs(savedLogs, savedVersion) {
    if (!savedLogs || typeof savedLogs !== 'object') return {};
    return Object.fromEntries(Object.entries(savedLogs).filter(([, log]) => log && typeof log === 'object').map(([key, log]) => {
      const normalized = { ...log };
      // In v1/v2 the energy slider defaulted to 3 and was stored even when untouched.
      // That value is not distinguishable from a deliberate answer, so it is omitted on migration.
      if (Number(savedVersion) < 3 && Number(normalized.energy) === 3) delete normalized.energy;
      return [key, normalized];
    }));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return structuredClone(defaultState);
      return {
        ...structuredClone(defaultState), ...saved,
        version: 3,
        profile: { ...defaultState.profile, ...(saved.profile || {}) },
        nutrition: normalizeNutrition(saved.nutrition),
        settings: {
          ...defaultState.settings, ...(saved.settings || {}),
          reminders: { ...defaultState.settings.reminders, ...(saved.settings?.reminders || {}) }
        },
        periodStarts: Array.isArray(saved.periodStarts) ? saved.periodStarts.filter(isDateKey) : [],
        logs: normalizeLogs(saved.logs, saved.version),
        notificationHistory: saved.notificationHistory || {}
      };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    modelCache.clear();
    wellbeingCache = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12); }
  function dateKey(date) {
    const d = startOfDay(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isDateKey(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(parseDate(value).getTime()); }
  function parseDate(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  }
  function addDays(date, days) { const result = startOfDay(date); result.setDate(result.getDate() + days); return result; }
  function dayDiff(from, to) { return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
  function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function standardDeviation(values) {
    if (values.length < 2) return 2.5;
    const average = mean(values);
    return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
  }
  function formatDate(date, options = { day: 'numeric', month: 'short' }) {
    return new Intl.DateTimeFormat('es-ES', options).format(date).replace('.', '');
  }
  function formatDateTimeLocal(date = new Date()) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
  function pluralDays(days) { return `${days} ${days === 1 ? 'día' : 'días'}`; }

  function observedCycleLengths() {
    const starts = [...new Set(state.periodStarts)].sort();
    return starts.slice(1).map((key, index) => dayDiff(parseDate(starts[index]), parseDate(key))).filter(days => days >= 15 && days <= 90);
  }

  function ovulationModelForCycle(start, cycleLength, asOf = today) {
    const safeLength = clamp(Math.round(cycleLength), 15, 90);
    const effectiveAsOf = asOf > today ? today : asOf;
    const cacheKey = `${dateKey(start)}:${safeLength}:${dateKey(effectiveAsOf)}`;
    if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
    const end = addDays(start, safeLength - 1);
    const logs = Object.entries(state.logs)
      .filter(([key]) => {
        const date = parseDate(key);
        return date >= start && date <= end && date <= effectiveAsOf;
      })
      .map(([key, log]) => ({ ...log, day: dayDiff(start, parseDate(key)) + 1 }));
    let variability = observedCycleLengths().length >= 2 ? standardDeviation(observedCycleLengths()) : 2.8;
    if (state.profile.cyclePattern === 'variable') variability = Math.max(variability, 5);
    if (state.profile.context === 'perimenopause' || state.profile.context === 'postpartum') variability = Math.max(variability, 6);
    const result = window.MareaCycleModel.inferOvulation({
      cycleLength: safeLength,
      periodLength: state.profile.periodLength,
      variability,
      historyCount: observedCycleLengths().length,
      configured: state.profile.configured,
      logs
    });
    modelCache.set(cacheKey, result);
    return result;
  }

  function personalizedLutealLength() {
    const starts = [...new Set(state.periodStarts)].sort().map(parseDate);
    const estimates = [];
    for (let index = 0; index < starts.length - 1; index += 1) {
      const length = dayDiff(starts[index], starts[index + 1]);
      if (length < 15 || length > 90) continue;
      const posterior = ovulationModelForCycle(starts[index], length, starts[index + 1]);
      if (posterior.confirmedBySignals) estimates.push(clamp(length - posterior.modeDay, 9, 18));
    }
    return estimates.length ? Math.round(median(estimates)) : 14;
  }

  function predictionModel(asOf = today) {
    const observed = observedCycleLengths();
    const prior = clamp(Number(state.profile.averageCycle) || 29, 15, 60);
    const center = observed.length ? median(observed) : prior;
    const mad = observed.length ? median(observed.map(value => Math.abs(value - center))) : 2.5;
    const outlierLimit = Math.max(7, mad * 3);
    const usable = observed.filter(value => Math.abs(value - center) <= outlierLimit);
    const weighted = usable.length
      ? usable.reduce((sum, value, index) => sum + value * (1 + index * .18), 0) / usable.reduce((sum, _, index) => sum + (1 + index * .18), 0)
      : prior;
    const personalWeight = Math.min(.88, usable.length / (usable.length + 2.2));
    const baseLength = clamp(Math.round(prior * (1 - personalWeight) + weighted * personalWeight), 15, 60);
    let variability = observed.length >= 2 ? Math.max(1.5, standardDeviation(usable.length > 1 ? usable : observed)) : 2.8;
    if (state.profile.cyclePattern === 'variable') variability = Math.max(variability, 5);
    if (state.profile.context === 'perimenopause' || state.profile.context === 'postpartum') variability = Math.max(variability, 6);

    const fallbackStart = addDays(today, -8);
    const starts = state.periodStarts.map(parseDate).filter(date => date <= asOf).sort((a, b) => a - b);
    const currentStart = starts.at(-1) || fallbackStart;
    const currentDay = Math.max(1, dayDiff(currentStart, asOf) + 1);
    const adjustedLength = currentDay >= baseLength ? Math.min(90, currentDay + Math.max(1, Math.ceil(variability * .7))) : baseLength;
    const ovulation = ovulationModelForCycle(currentStart, adjustedLength, asOf);
    const lutealLength = personalizedLutealLength();
    let nextStart = addDays(currentStart, adjustedLength);
    if (ovulation.confirmedBySignals && ovulation.modeDay <= currentDay + 1) {
      nextStart = addDays(currentStart, ovulation.modeDay + lutealLength);
      if (nextStart <= asOf) nextStart = addDays(asOf, Math.max(1, Math.ceil(variability * .55)));
    }
    const window = ovulation.confirmedBySignals
      ? clamp(Math.ceil((ovulation.highDay - ovulation.lowDay) / 2 + 1.5), 1, 10)
      : clamp(Math.ceil(variability * .8), 1, 10);
    let confidence = clamp(Math.round(50 + usable.length * 8 - variability * 3.2), 32, 94);
    if (ovulation.confirmedBySignals) confidence = clamp(Math.round(confidence * .42 + ovulation.confidence * .58), 35, 92);
    if (!state.profile.configured) confidence = 36;
    if (['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context)) confidence = 0;
    if (state.profile.context === 'perimenopause') confidence = Math.min(confidence, 58);

    return { observed, prior, baseLength, adjustedLength, variability, currentStart, currentDay, nextStart, window, confidence, ovulation, lutealLength };
  }

  function cyclePosition(date) {
    const model = predictionModel(date > today ? today : date);
    const starts = state.periodStarts.map(parseDate).sort((a, b) => a - b);
    let start = starts.filter(item => item <= date).at(-1);
    let cycleLength = model.baseLength;
    let synthetic = false;
    let overdue = false;

    if (start) {
      const nextActual = starts.find(item => item > start);
      if (nextActual && date < nextActual) cycleLength = clamp(dayDiff(start, nextActual), 15, 90);
      else if (!nextActual) {
        if (date > today && date >= model.nextStart) {
          start = model.nextStart;
          cycleLength = model.baseLength;
          synthetic = true;
          while (dayDiff(start, date) >= cycleLength) start = addDays(start, cycleLength);
        } else {
          cycleLength = date > today
            ? clamp(dayDiff(start, model.nextStart), 15, 90)
            : Math.max(model.adjustedLength, dayDiff(start, date) + 1);
          overdue = date <= today && dayDiff(start, date) + 1 > model.baseLength + model.window;
        }
      }
    } else {
      start = starts[0] || model.currentStart;
      synthetic = true;
      while (start > date) start = addDays(start, -cycleLength);
      while (dayDiff(start, date) >= cycleLength) start = addDays(start, cycleLength);
    }
    return { day: dayDiff(start, date) + 1, length: cycleLength, start, synthetic, overdue };
  }

  function phaseForDate(date) {
    if (['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context)) return { key: 'tracking', ...phaseMeta.tracking, day: null, length: null };
    const position = cyclePosition(date);
    const periodLength = clamp(Number(state.profile.periodLength) || 5, 1, 14);
    const posterior = ovulationModelForCycle(position.start, position.length, today);
    if (position.overdue || (state.profile.context === 'perimenopause' && !posterior.confirmedBySignals)) {
      return { key: 'uncertain', ...phaseMeta.uncertain, ...position, posterior };
    }
    const probabilities = window.MareaCycleModel.phaseProbabilities(posterior, position.day, periodLength);
    const ovulationDay = posterior.modeDay;
    let key = 'luteal';
    if (position.day <= periodLength) key = 'menstrual';
    else if (position.day === ovulationDay || probabilities.ovulation >= .16) key = 'ovulation';
    else if (probabilities.fertile >= .3 || (position.day >= posterior.lowDay - 5 && position.day <= posterior.highDay)) key = 'fertile';
    else if (position.day < ovulationDay - 5) key = 'follicular';
    return { key, ...phaseMeta[key], ...position, ovulationDay, posterior, phaseProbabilities: probabilities };
  }

  function nextPhase(date, currentKey) {
    if (currentKey === 'uncertain') {
      const offset = Math.max(1, dayDiff(date, predictionModel().nextStart));
      return { phase: phaseForDate(addDays(date, offset)), offset };
    }
    for (let offset = 1; offset <= 40; offset += 1) {
      const phase = phaseForDate(addDays(date, offset));
      if (phase.key !== currentKey) return { phase, offset };
    }
    return { phase: phaseForDate(addDays(date, 1)), offset: 1 };
  }

  function hormoneContextForDate(date) {
    if (['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context)) return null;
    const position = cyclePosition(date);
    const periodLength = clamp(Number(state.profile.periodLength) || 5, 1, 14);
    const posterior = ovulationModelForCycle(position.start, position.length, date > today ? today : date);
    if (position.overdue || (state.profile.context === 'perimenopause' && !posterior.confirmedBySignals)) return null;
    return {
      ...position,
      posterior,
      stage: window.MareaCycleModel.hormonalStage({ posterior, cycleDay: position.day, cycleLength: position.length, periodLength }),
      series: window.MareaCycleModel.hormoneSeries({ posterior, cycleLength: position.length, periodLength })
    };
  }

  function wellbeingCoordinate(date) {
    const starts = state.periodStarts.map(parseDate).sort((a, b) => a - b);
    const baseLength = clamp(Math.round(median(observedCycleLengths()) || Number(state.profile.averageCycle) || 29), 15, 60);
    let start = starts.filter(item => item <= date).at(-1) || addDays(today, -8);
    let length = baseLength;
    const nextActual = starts.find(item => item > start);
    if (nextActual && date < nextActual) length = clamp(dayDiff(start, nextActual), 15, 90);
    else if (starts.length && start.getTime() === starts.at(-1)?.getTime()) length = Math.max(baseLength, dayDiff(start, today) + 1);
    else {
      while (start > date) start = addDays(start, -length);
      while (dayDiff(start, date) >= length) start = addDays(start, length);
    }
    const cycleDay = dayDiff(start, date) + 1;
    const posterior = ovulationModelForCycle(start, length, today);
    let x = 0;
    let y = 0;
    posterior.days.forEach((ovulationDay, index) => {
      const angle = ((cycleDay - ovulationDay) / length) * Math.PI * 2;
      x += Math.cos(angle) * posterior.probabilities[index];
      y += Math.sin(angle) * posterior.probabilities[index];
    });
    return Math.atan2(y, x);
  }

  function circularDistance(first, second) {
    const raw = Math.abs(first - second) % (Math.PI * 2);
    return Math.min(raw, Math.PI * 2 - raw);
  }

  function numericWellbeing(log, field) {
    if (field === 'mood') return moodScores[log.mood] || null;
    const value = Number(log[field]);
    return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
  }

  function weightedWellbeingEstimate(targetCoordinate, training) {
    let weightedSum = 0;
    let totalWeight = 0;
    training.forEach(sample => {
      const phaseWeight = Math.exp(-0.5 * (circularDistance(targetCoordinate, sample.coordinate) / 0.72) ** 2);
      const recencyWeight = Math.exp(-Math.max(0, dayDiff(sample.date, today)) / 420);
      const weight = phaseWeight * recencyWeight;
      weightedSum += sample.value * weight;
      totalWeight += weight;
    });
    return totalWeight ? weightedSum / totalWeight : median(training.map(sample => sample.value));
  }

  function fitWellbeingMetric(field) {
    const samples = Object.entries(state.logs)
      .filter(([key]) => isDateKey(key) && parseDate(key) < today)
      .map(([key, log]) => ({ date: parseDate(key), value: numericWellbeing(log, field) }))
      .filter(sample => sample.value !== null)
      .sort((a, b) => a.date - b.date)
      .slice(-365)
      .map(sample => ({ ...sample, coordinate: wellbeingCoordinate(sample.date) }));
    const baseline = samples.length ? median(samples.slice(-60).map(sample => sample.value)) : 3;
    const contextEligible = ['natural', 'trying'].includes(state.profile.context);
    const span = samples.length > 1 ? dayDiff(samples[0].date, samples.at(-1).date) : 0;
    const enoughData = contextEligible && observedCycleLengths().length >= 2 && samples.length >= 14 && span >= 35;
    let phaseError = 0;
    let baselineError = 0;
    let validations = 0;
    if (enoughData) {
      samples.forEach((sample, index) => {
        const training = samples.slice(Math.max(0, index - 90), index);
        if (training.length < 7) return;
        phaseError += Math.abs(sample.value - weightedWellbeingEstimate(sample.coordinate, training));
        baselineError += Math.abs(sample.value - median(training.map(item => item.value)));
        validations += 1;
      });
    }
    const improvement = validations && baselineError ? 1 - phaseError / baselineError : 0;
    const active = enoughData && validations >= 7 && improvement >= .1;
    const value = active ? weightedWellbeingEstimate(wellbeingCoordinate(today), samples) : baseline;
    const residuals = samples.slice(-90).map(sample => Math.abs(sample.value - baseline));
    const spread = clamp((median(residuals) || .75) * 1.48, .55, 1.6);
    return {
      field, samples: samples.length, active, value: clamp(value, 1, 5), low: clamp(value - spread, 1, 5), high: clamp(value + spread, 1, 5),
      improvement, confidence: active ? clamp(Math.round(38 + samples.length * 1.4 + improvement * 80), 42, 82) : 0,
      reason: !contextEligible ? 'El componente cíclico no se aplica en el contexto seleccionado.'
        : observedCycleLengths().length < 2 ? 'Necesita al menos dos ciclos completos.'
          : samples.length < 14 || span < 35 ? 'Necesita más días distribuidos durante el ciclo.'
            : improvement < .1 ? 'Tu patrón cíclico no mejora todavía la referencia personal neutral.' : ''
    };
  }

  function wellbeingPrediction() {
    if (wellbeingCache) return wellbeingCache;
    const mood = fitWellbeingMetric('mood');
    const energy = fitWellbeingMetric('energy');
    wellbeingCache = { mood, energy, active: mood.active || energy.active, usefulDays: Math.max(mood.samples, energy.samples) };
    return wellbeingCache;
  }

  function wellbeingLabel(value, field) {
    if (field === 'energy') return value < 1.8 ? 'Muy baja' : value < 2.6 ? 'Baja' : value < 3.6 ? 'Habitual' : value < 4.4 ? 'Alta' : 'Muy alta';
    return value < 1.8 ? 'Muy bajo' : value < 2.6 ? 'Más bajo de lo habitual' : value < 3.6 ? 'Cerca de lo habitual' : value < 4.4 ? 'Positivo' : 'Muy positivo';
  }

  function recentLogEntries(days) {
    const firstDay = addDays(today, -(days - 1));
    return Object.entries(state.logs)
      .filter(([key]) => isDateKey(key) && parseDate(key) >= firstDay && parseDate(key) <= today)
      .map(([key, log]) => ({ key, date: parseDate(key), log }))
      .sort((a, b) => a.date - b.date);
  }

  function wellbeingAnomalyStatus() {
    const fitted = wellbeingPrediction();
    const candidates = [];
    ['mood', 'energy'].forEach(field => {
      const samples = Object.entries(state.logs)
        .filter(([key]) => isDateKey(key) && parseDate(key) <= today)
        .map(([key, log]) => ({ date: parseDate(key), value: numericWellbeing(log, field) }))
        .filter(sample => sample.value !== null)
        .sort((a, b) => a.date - b.date)
        .slice(-180)
        .map(sample => ({ ...sample, coordinate: wellbeingCoordinate(sample.date) }));
      const residuals = [];
      samples.forEach((sample, index) => {
        const training = samples.slice(Math.max(0, index - 120), index);
        if (training.length < 10) return;
        const center = median(training.map(item => item.value));
        const spread = Math.max(.55, median(training.map(item => Math.abs(item.value - center))) * 1.4826);
        const predicted = fitted[field].active ? weightedWellbeingEstimate(sample.coordinate, training) : center;
        residuals.push({ date: sample.date, standardized: (sample.value - predicted) / spread });
      });
      const lastFiveDays = residuals.filter(item => item.date >= addDays(today, -4));
      const lastFourteenDays = residuals.filter(item => item.date >= addDays(today, -13));
      const lowFive = lastFiveDays.filter(item => item.standardized < -1.5);
      const lowFourteen = lastFourteenDays.filter(item => item.standardized < -1);
      if ((lastFiveDays.length >= 3 && lowFive.length >= 3) || (lastFourteenDays.length >= 7 && lowFourteen.length >= 7)) {
        candidates.push({ field, count: Math.max(lowFive.length, lowFourteen.length), active: fitted[field].active });
      }
    });
    if (!candidates.length) return null;
    const strongest = candidates.sort((a, b) => b.count - a.count)[0];
    const label = strongest.field === 'mood' ? 'ánimo' : 'energía';
    return {
      level: 'checkin', kicker: 'CAMBIO RESPECTO A TU PATRÓN', title: 'Haz un check-in de contexto',
      copy: `Tu ${label} ha quedado repetidamente por debajo de ${strongest.active ? 'la predicción personal cíclica' : 'tu referencia personal'} en los últimos días. Revisa sueño, estrés, dolor, enfermedad o medicación; una anomalía estadística no es un diagnóstico.`, urgent: false
    };
  }

  function healthPatternStatus() {
    const safetyEntries = recentLogEntries(3).filter(({ log }) => log.safetyConcern);
    if (safetyEntries.length) return {
      level: 'urgent', kicker: 'AYUDA INMEDIATA', title: 'No tienes que gestionar esto a solas',
      copy: 'Has indicado preocupación por hacerte daño. Llama al 024; si existe peligro inmediato, llama al 112 o acude a urgencias.', urgent: true
    };
    const fortnight = recentLogEntries(14);
    const moodEntries = fortnight.filter(({ log }) => log.mood || log.lowInterest);
    const lowMood = moodEntries.filter(({ log }) => (moodScores[log.mood] || 5) <= 2.2 || log.lowInterest);
    const moodSpan = moodEntries.length > 1 ? dayDiff(moodEntries[0].date, moodEntries.at(-1).date) : 0;
    if (moodEntries.length >= 8 && moodSpan >= 13 && lowMood.length / moodEntries.length >= .65) return {
      level: 'attention', kicker: 'PATRÓN DE DOS SEMANAS', title: 'Valora hablar con un profesional',
      copy: `Ánimo bajo o pérdida de interés aparece en ${lowMood.length} de ${moodEntries.length} registros recientes${moodEntries.some(({ log }) => log.dailyImpact) ? ' y has indicado impacto en tu vida diaria' : ''}. La fase no explica por sí sola este patrón.`, urgent: false
    };
    const threeWeeks = recentLogEntries(21);
    const energyEntries = threeWeeks.filter(({ log }) => numericWellbeing(log, 'energy') !== null);
    const veryLowEnergy = energyEntries.filter(({ log }) => numericWellbeing(log, 'energy') <= 2);
    const energySpan = energyEntries.length > 1 ? dayDiff(energyEntries[0].date, energyEntries.at(-1).date) : 0;
    if (energyEntries.length >= 10 && energySpan >= 20 && veryLowEnergy.length / energyEntries.length >= .7) return {
      level: 'attention', kicker: 'ENERGÍA BAJA PERSISTENTE', title: 'Conviene valorar la fatiga',
      copy: `La energía fue baja en ${veryLowEnergy.length} de ${energyEntries.length} registros durante varias semanas. Sueño, estrés, dolor, enfermedad, medicación y otras causas también importan.`, urgent: false
    };
    const anomaly = wellbeingAnomalyStatus();
    if (anomaly) return anomaly;
    const lengths = observedCycleLengths();
    const lastTwoAtypical = lengths.length >= 2 && lengths.slice(-2).every(length => length < 21 || length > 35);
    if (lastTwoAtypical) return {
      level: 'attention', kicker: 'CAMBIO DEL CICLO', title: 'Dos ciclos están fuera del intervalo habitual',
      copy: `Los dos últimos ciclos duraron ${lengths.slice(-2).join(' y ')} días. Puede haber muchas causas; si el cambio es nuevo o te preocupa, coméntalo en consulta.`, urgent: false
    };
    const useful = Object.values(state.logs).filter(log => log.mood || log.energy || log.lowInterest).length;
    return useful < 8
      ? { level: 'learning', kicker: 'SEGUIMIENTO LONGITUDINAL', title: 'Aún no hay suficientes datos para comparar', copy: 'Marea buscará cambios persistentes durante semanas; un día aislado nunca activa una recomendación médica.', urgent: false }
      : { level: 'ok', kicker: 'SEGUIMIENTO LONGITUDINAL', title: 'Sin cambios persistentes detectados', copy: `La comparación utiliza ${useful} días de bienestar. Esto no descarta un problema ni sustituye cómo te sientes.`, urgent: false };
  }

  function dietBlocks(tag, dietType = state.nutrition.dietType) {
    if (dietType === 'omnivore') return false;
    if (dietType === 'pescatarian') return tag === 'meat';
    if (dietType === 'vegetarian') return ['meat', 'fish', 'crustaceans', 'molluscs'].includes(tag);
    if (dietType === 'lacto-vegetarian') return ['meat', 'fish', 'crustaceans', 'molluscs', 'egg'].includes(tag);
    if (dietType === 'ovo-vegetarian') return ['meat', 'fish', 'crustaceans', 'molluscs', 'milk'].includes(tag);
    return ['meat', 'fish', 'crustaceans', 'molluscs', 'milk', 'egg'].includes(tag);
  }

  function intoleranceBlockedTags() {
    const tags = new Set();
    const rules = { lactose: ['milk'], fructose: ['fruit'], histamine: ['fish'], gluten: ['gluten'], fodmap: ['legumes'] };
    (state.nutrition.intolerances || []).forEach(item => (rules[item] || []).forEach(tag => tags.add(tag)));
    return tags;
  }

  function optionIsCompatible(option) {
    const tags = option.tags || [];
    const allergies = new Set(state.nutrition.allergies || []);
    const intoleranceTags = intoleranceBlockedTags();
    const optionText = String(option.text || '').toLocaleLowerCase('es-ES');
    const customAllergies = state.nutrition.allergyOther.split(',').map(item => item.trim().toLocaleLowerCase('es-ES')).filter(Boolean);
    return !tags.some(tag => dietBlocks(tag) || allergies.has(tag) || (state.nutrition.celiac && tag === 'gluten') || intoleranceTags.has(tag))
      && !customAllergies.some(allergy => optionText.includes(allergy));
  }

  function chooseCompatible(options) {
    const selected = options.find(optionIsCompatible) || { text: 'una opción que ya toleras, verificando la etiqueta actual', tags: [] };
    const customAllergies = state.nutrition.allergyOther.split(',').map(item => item.trim()).filter(Boolean);
    if (!customAllergies.length || !(selected.tags || []).length) return selected;
    return { ...selected, text: `${selected.text}; excluye también ${customAllergies.join(', ')} y comprueba la etiqueta actual` };
  }

  function nutritionSuggestionsForToday() {
    const log = state.logs[dateKey(today)] || {};
    const wellbeing = wellbeingPrediction();
    const tips = [];
    const addTip = (title, reason, options) => {
      if (tips.some(tip => tip.title === title)) return;
      tips.push({ title, reason, option: chooseCompatible(options).text });
    };
    if (['medium', 'heavy'].includes(log.flow)) addTip('Hierro alimentario + vitamina C', 'Por el sangrado que has registrado; no sustituye una analítica si hay fatiga o sangrado persistente.', [
      { text: 'legumbres con una fuente de vitamina C que toleres', tags: ['legumes', 'vegetables'] },
      { text: 'verduras de hoja verde y una fuente de vitamina C que toleres', tags: ['vegetables'] },
      { text: 'carne magra con una verdura rica en vitamina C que toleres', tags: ['meat', 'vegetables'] }
    ]);
    const predictedLow = wellbeing.energy.active && wellbeing.energy.value < 2.7;
    const loggedEnergy = numericWellbeing(log, 'energy');
    if ((loggedEnergy !== null && loggedEnergy <= 2) || predictedLow) addTip('Energía sostenida', predictedLow ? 'Tu modelo personal estima energía por debajo de tu nivel habitual.' : 'Hoy has registrado energía baja.', [
      { text: 'arroz integral, verduras que toleres y legumbres compatibles', tags: ['wholegrains', 'vegetables', 'legumes'] },
      { text: 'patata, verduras que toleres y huevo', tags: ['vegetables', 'egg'] },
      { text: 'arroz integral, verduras que toleres y pescado', tags: ['wholegrains', 'vegetables', 'fish'] },
      { text: 'patata, verduras que toleres y una proteína compatible', tags: ['vegetables'] }
    ]);
    if ((log.symptoms || []).includes('bloating')) addTip('Hidratación y menos sal', 'La hinchazón está registrada hoy; observa tu respuesta sin iniciar dietas de eliminación por tu cuenta.', [{ text: 'agua y comidas sencillas con poca sal añadida', tags: [] }]);
    if ((log.symptoms || []).includes('cravings')) addTip('Comida regular y completa', 'Los antojos están registrados hoy; combinar hidrato complejo, proteína y vegetales puede apoyar la saciedad.', [
      { text: 'arroz integral, verduras que toleres y legumbres compatibles', tags: ['wholegrains', 'vegetables', 'legumes'] },
      { text: 'patata, verduras que toleres y huevo', tags: ['vegetables', 'egg'] },
      { text: 'cereal integral con gluten, verduras que toleres y yogur natural', tags: ['wholegrains', 'vegetables', 'milk', 'gluten'] }
    ]);
    if (state.nutrition.dietType === 'vegan') addTip('Fuente fiable de vitamina B12', 'En alimentación vegana es esencial planificar una fuente fiable; la app no prescribe dosis.', [
      { text: 'alimentos fortificados compatibles y valoración profesional de suplementación', tags: [] }
    ]);
    addTip('Plato variado', 'Base general mientras el modelo aprende tu respuesta personal.', [
      { text: 'verduras que toleres, arroz integral y legumbres compatibles', tags: ['vegetables', 'wholegrains', 'legumes'] },
      { text: 'verduras que toleres, patata y huevo', tags: ['vegetables', 'egg'] },
      { text: 'verduras que toleres, arroz integral y pescado', tags: ['vegetables', 'wholegrains', 'fish'] },
      { text: 'verduras que toleres, arroz integral y una proteína compatible', tags: ['vegetables', 'wholegrains'] }
    ]);
    addTip('Calcio alimentario', 'Ayuda a cubrir necesidades generales; no se presenta como tratamiento hormonal.', [
      { text: 'yogur natural o leche', tags: ['milk'] },
      { text: 'tofu cuajado con calcio, revisando la etiqueta', tags: ['soy'] },
      { text: 'verduras verdes que ya sepas que toleras', tags: ['vegetables'] }
    ]);
    addTip('Hidratación', 'El agua sigue siendo la opción principal durante todo el ciclo.', [{ text: 'agua repartida a lo largo del día', tags: [] }]);
    return tips.slice(0, 3);
  }

  function foodSafetyForLog(log = {}) {
    const foods = new Set(log.foods || []);
    const allergies = new Set(state.nutrition.allergies || []);
    const allergyHits = [...foods].filter(food => allergies.has(food));
    if (foods.has('unknown') && (allergies.size || state.nutrition.allergyOther.trim())) allergyHits.push('unknown');
    const celiacHits = state.nutrition.celiac && foods.has('gluten') ? ['gluten'] : [];
    const note = String(log.foodNote || '').toLocaleLowerCase('es-ES');
    state.nutrition.allergyOther.split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
      if (note.includes(item.toLocaleLowerCase('es-ES'))) allergyHits.push(item);
    });
    const intoleranceTags = intoleranceBlockedTags();
    const intoleranceHits = [...foods].filter(food => intoleranceTags.has(food));
    state.nutrition.intoleranceOther.split(',').map(item => item.trim()).filter(Boolean).forEach(item => {
      if (note.includes(item.toLocaleLowerCase('es-ES'))) intoleranceHits.push(item);
    });
    const dietConflicts = [...foods].filter(food => dietBlocks(food));
    return { allergyHits: [...new Set(allergyHits)], celiacHits, intoleranceHits: [...new Set(intoleranceHits)], dietConflicts };
  }

  function fecundabilityForOffset(offset) {
    // Smoothed, conservative curve anchored to prospective hormone-confirmed
    // observations (roughly 10% at -5 days and 33% on ovulation day).
    const curve = { '-7': .005, '-6': .025, '-5': .10, '-4': .16, '-3': .20, '-2': .27, '-1': .31, '0': .33, '1': .005 };
    return curve[String(offset)] || 0;
  }

  function pregnancyRiskForDate(date, log = {}) {
    const context = state.profile.context;
    if (['hormonal', 'pregnant', 'postpartum'].includes(context)) {
      return {
        calculable: false,
        reason: context === 'pregnant'
          ? 'El perfil está en modo embarazo; no se calcula una nueva probabilidad.'
          : 'El calendario no puede estimar el riesgo con anticoncepción hormonal, embarazo o posparto. Depende del método y de cómo se haya utilizado.'
      };
    }
    const position = cyclePosition(date);
    const posterior = ovulationModelForCycle(position.start, position.length, today);
    const weightedProbability = posterior.days.reduce((sum, ovulationDay, index) => {
      const intercourseOffset = position.day - ovulationDay;
      return sum + posterior.probabilities[index] * fecundabilityForOffset(intercourseOffset);
    }, 0);
    const probability = clamp(weightedProbability * 100, 0, 33);
    const uncertainty = clamp(.78 - posterior.confidence * .0042, .42, .82);
    const low = clamp(probability * (1 - uncertainty), 0, 33);
    const high = clamp(probability * (1 + uncertainty) + .6, .6, 33);
    const confidence = clamp(Math.round(posterior.confidence * .74), 20, 70);
    const daysSince = dayDiff(date, today);
    const [hour, minute] = String(log.sexualTime || '12:00').split(':').map(Number);
    const eventTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour || 0, minute || 0);
    const hoursSince = (Date.now() - eventTime.getTime()) / 3600000;
    return {
      calculable: true, probability, low, high, confidence, daysSince, hoursSince,
      urgent: log.sexualTime ? hoursSince >= 0 && hoursSince <= 120 : daysSince >= 0 && daysSince <= 5,
      testDate: addDays(date, 21),
      posterior,
      signals: posterior.signalTypes,
      category: probability < 2 ? 'muy baja' : probability < 8 ? 'baja' : probability < 18 ? 'moderada' : 'alta'
    };
  }

  function formatRiskPercent(value) {
    if (value < .1) return '<0,1%';
    if (value < 10) return `${value.toFixed(1).replace('.', ',')}%`;
    return `${Math.round(value)}%`;
  }

  function signalLabelList(posterior) {
    return posterior.signalTypes.map(type => modelSignalLabels[type] || type);
  }

  function renderSignalTags(containerSelector, posterior) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const active = new Set(posterior.signalTypes);
    container.innerHTML = Object.entries(modelSignalLabels).map(([type, label]) => `<span class="${active.has(type) ? 'active' : ''}">${active.has(type) ? '✓' : '○'} ${label}</span>`).join('');
  }

  function renderAll() {
    applyTheme();
    renderDashboard();
    renderCalendar();
    renderInsights();
    renderSettings();
    updateSetupBanner();
  }

  function renderDashboard() {
    const model = predictionModel();
    const phase = phaseForDate(today);
    const upcoming = nextPhase(today, phase.key);
    const dateLabel = document.querySelector('#today-label');
    if (dateLabel) dateLabel.textContent = formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('es-ES');
    setText('#phase-pill', phase.label);
    setText('#cycle-day', phase.day ?? '—');
    setText('#orbit-day', phase.day ?? '·');
    setText('#orbit-length', phase.length ?? '·');
    setText('#phase-copy', phase.copy);
    setText('#next-phase', phase.key === 'uncertain' ? 'Sin transición fiable' : `${upcoming.phase.label} · en ${pluralDays(upcoming.offset)}`);
    setText('#confidence-button', model.confidence ? `${model.confidence}% confianza` : 'Sin predicción de fase');
    setText('#next-period-date', formatDate(model.nextStart));
    setText('#period-window', `Ventana estimada: ${formatDate(addDays(model.nextStart, -model.window))}–${formatDate(addDays(model.nextStart, model.window))}`);
    setText('#variability-note', `± ${model.window} ${model.window === 1 ? 'día' : 'días'} según ${model.observed.length ? 'tu historial' : 'la estimación inicial'}`);
    const orbit = document.querySelector('.cycle-orbit');
    if (orbit && phase.day && phase.length) {
      const percentage = clamp((phase.day / phase.length) * 100, 2, 100);
      orbit.style.background = `conic-gradient(var(--accent) 0 ${percentage}%, var(--peach) ${percentage}% ${Math.min(percentage + 14, 100)}%, color-mix(in srgb, var(--peach) 48%, var(--line)) ${Math.min(percentage + 14, 100)}% 100%)`;
    }
    renderWeek();
    renderQuickLog();
    renderDailyContext();
    renderHealthPattern();
    renderFoodSafetyCard();
  }

  function renderDailyContext() {
    const hormoneContext = hormoneContextForDate(today);
    const hormoneBars = document.querySelector('#hormone-bars');
    if (!hormoneContext) {
      const currentPhase = phaseForDate(today);
      setText('#hormone-stage', currentPhase.key === 'uncertain' ? 'Fase incierta' : 'Modelo no aplicable');
      setText('#hormone-stage-copy', currentPhase.key === 'uncertain'
        ? 'El ciclo superó su ventana prevista o el contexto es muy variable. Confirma un nuevo sangrado o añade biomarcadores; no se reinicia el ciclo automáticamente.'
        : 'En anticoncepción hormonal, embarazo o posparto no se reconstruye un patrón ovulatorio natural.');
      if (hormoneBars) hormoneBars.innerHTML = '<p class="empty-state">Tus registros siguen disponibles, sin inferir hormonas.</p>';
    } else {
      const { stage } = hormoneContext;
      setText('#hormone-stage', `${stage.label} · confianza ${Math.round(stage.confidence || 0)}%`);
      setText('#hormone-stage-copy', stage.summary);
      if (hormoneBars) hormoneBars.innerHTML = Object.entries(hormoneLabels).map(([key, label]) => {
        const value = stage.hormones[key];
        return `<div class="hormone-bar"><span>${label}</span><i style="--value:${value}%;--bar-color:${hormoneColors[key]}"></i><b>${Math.round(value)}</b></div>`;
      }).join('');
    }
    const wellbeing = wellbeingPrediction();
    const activeMetrics = [wellbeing.mood, wellbeing.energy].filter(metric => metric.active);
    setText('#wellbeing-title', activeMetrics.length ? 'Predicción personal activa' : 'Aprendiendo tu patrón');
    setText('#predicted-mood', wellbeing.mood.active ? wellbeingLabel(wellbeing.mood.value, 'mood') : 'Nivel personal habitual');
    setText('#predicted-energy', wellbeing.energy.active ? wellbeingLabel(wellbeing.energy.value, 'energy') : 'Nivel personal habitual');
    setText('#wellbeing-copy', activeMetrics.length
      ? 'La estimación usa únicamente tus patrones repetidos y mantiene un intervalo amplio. No presupone que una fase cause tu estado.'
      : wellbeing.mood.reason || wellbeing.energy.reason || 'Aún no hay un patrón cíclico repetible que mejore tu referencia personal.');
    const confidence = activeMetrics.length ? Math.round(mean(activeMetrics.map(metric => metric.confidence))) : 0;
    setText('#wellbeing-confidence', `${wellbeing.usefulDays} días útiles · ${activeMetrics.length ? `${confidence}% confianza interna` : 'componente cíclico desactivado'}`);
    if (!state.nutrition.configured) {
      setText('#nutrition-title', 'Configura tu alimentación');
      const container = document.querySelector('#nutrition-suggestions');
      if (container) container.innerHTML = '<p>Indica tu dieta, alergias e intolerancias para recibir opciones compatibles.</p>';
      setText('#open-nutrition-settings', 'Configurar perfil →');
    } else {
      setText('#nutrition-title', `Opciones para dieta ${dietLabels[state.nutrition.dietType] || state.nutrition.dietType}`);
      const tips = nutritionSuggestionsForToday();
      const container = document.querySelector('#nutrition-suggestions');
      if (container) container.innerHTML = tips.map(tip => `<div class="nutrition-tip"><strong>${escapeHtml(tip.title)}</strong><span>${escapeHtml(tip.option)} · ${escapeHtml(tip.reason)}</span></div>`).join('');
      setText('#open-nutrition-settings', 'Editar perfil →');
    }
  }

  function renderHealthPattern() {
    const status = healthPatternStatus();
    const card = document.querySelector('#health-pattern-card');
    if (!card) return;
    card.classList.toggle('attention', ['attention', 'checkin'].includes(status.level));
    card.classList.toggle('urgent', status.level === 'urgent');
    setText('#health-pattern-kicker', status.kicker);
    setText('#health-pattern-title', status.title);
    setText('#health-pattern-copy', status.copy);
    const icon = card.querySelector('.health-pattern-icon');
    if (icon) icon.textContent = status.level === 'urgent' ? '!' : ['attention', 'checkin'].includes(status.level) ? '↗' : '✓';
    setText('#open-health-model', status.urgent ? 'Ver ayuda inmediata →' : 'Cómo funcionan las alertas →');
  }

  function renderFoodSafetyCard() {
    const card = document.querySelector('#food-safety-card');
    if (!card) return;
    const safety = foodSafetyForLog(state.logs[dateKey(today)] || {});
    const hasWarning = safety.allergyHits.length || safety.celiacHits.length || safety.intoleranceHits.length || safety.dietConflicts.length;
    card.hidden = !hasWarning;
    if (!hasWarning) return;
    const parts = [];
    if (safety.allergyHits.length) parts.push(`Coincide con una alergia registrada: ${safety.allergyHits.map(item => foodLabels[item] || item).join(', ')}. Si tienes dificultad para respirar, voz ronca, hinchazón de lengua o garganta, mareo o desmayo, usa tu autoinyector según tu plan y llama al 112.`);
    if (safety.celiacHits.length) parts.push('Coincide con la celiaquía registrada: evita seguir consumiéndolo y revisa ingredientes y contacto cruzado. La celiaquía no es una alergia y este aviso no implica riesgo de anafilaxia.');
    if (safety.intoleranceHits.length) parts.push(`Coincide con una intolerancia registrada: ${safety.intoleranceHits.map(item => foodLabels[item] || item).join(', ')}. Observa cantidad y síntomas; busca ayuda si son intensos o persistentes.`);
    if (safety.dietConflicts.length) parts.push(`No coincide con tu dieta elegida: ${safety.dietConflicts.map(item => foodLabels[item] || item).join(', ')}.`);
    setText('#food-safety-title', safety.allergyHits.length ? 'Posible exposición a un alérgeno registrado' : safety.celiacHits.length ? 'Posible exposición a gluten con celiaquía registrada' : 'Revisa lo que has registrado');
    setText('#food-safety-copy', parts.join(' '));
    document.querySelector('#food-safety-emergency').hidden = !safety.allergyHits.length;
  }

  function renderWeek() {
    const strip = document.querySelector('#week-strip');
    if (!strip) return;
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = addDays(today, -mondayOffset);
    strip.innerHTML = '';
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(monday, offset);
      const phase = phaseForDate(date);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `day ${dateKey(date) === dateKey(today) ? 'current' : ''} ${phase.key}`;
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `${formatDate(date, { weekday: 'long', day: 'numeric' })}: ${phase.label}`);
      item.innerHTML = `<span>${['D','L','M','X','J','V','S'][date.getDay()]}</span><strong>${date.getDate()}</strong><i></i>`;
      item.addEventListener('click', () => openLog(dateKey(date)));
      strip.append(item);
    }
  }

  function renderQuickLog() {
    const log = state.logs[dateKey(today)] || {};
    setText('#quick-flow', log.flow ? flowLabels[log.flow] : 'Sin registrar');
    setText('#quick-mood', log.mood ? moodLabels[log.mood] : 'Sin registrar');
    setText('#quick-symptoms', log.symptoms?.length ? `${log.symptoms.length} registrad${log.symptoms.length === 1 ? 'o' : 'os'}` : 'Sin registrar');
    setText('#quick-sex', log.sexualActivity ? sexualActivityLabels[log.sexualActivity] : 'Sin registrar');
    setText('#quick-food', log.foods?.length ? `${log.foods.length} grupo${log.foods.length === 1 ? '' : 's'}` : log.foodNote ? log.foodNote.slice(0, 32) : 'Sin registrar');
    const biomarkerCount = [log.lhTest, log.pdgTest, log.temperature, log.cervical, log.wristTemperatureDelta, log.restingHeartRate, log.hrv].filter(value => value !== '' && value !== null && value !== undefined).length;
    setText('#quick-biomarkers', biomarkerCount ? `${biomarkerCount} señal${biomarkerCount === 1 ? '' : 'es'}` : 'Sin registrar');
    setText('#quick-note', log.note ? log.note.slice(0, 38) : 'Escribe lo que quieras');
    const cycleModel = predictionModel().ovulation;
    const phasesPaused = ['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context);
    setText('#model-readiness-value', phasesPaused ? 'Pausado' : `${cycleModel.confidence}%`);
    setText('#model-readiness-copy', phasesPaused
      ? 'En el contexto elegido Marea conserva tus registros, pero no asigna ovulación ni fases hormonales.'
      : cycleModel.signalTypes.length
        ? `Integra ${signalLabelList(cycleModel).join(', ')}. Ovulación probable entre los días ${cycleModel.lowDay} y ${cycleModel.highDay} del ciclo.`
        : 'De momento utiliza el historial del ciclo. Añade LH, temperatura o moco cervical para reducir la incertidumbre.');
    renderSignalTags('#model-readiness-signals', phasesPaused ? { ...cycleModel, signalTypes: [] } : cycleModel);
    const riskCard = document.querySelector('#daily-risk-card');
    if (riskCard) {
      const showRisk = log.sexualActivity === 'unprotected';
      riskCard.hidden = !showRisk;
      if (showRisk) {
        const risk = pregnancyRiskForDate(today, log);
        setText('#daily-risk-value', risk.calculable ? `≈ ${formatRiskPercent(risk.probability)}` : 'No calculable');
        setText('#daily-risk-copy', risk.calculable
          ? `Intervalo orientativo ${formatRiskPercent(risk.low)}–${formatRiskPercent(risk.high)}; confianza limitada al ${risk.confidence}%.`
          : risk.reason);
      }
    }
  }

  function renderCalendar() {
    const monthLabel = document.querySelector('#calendar-month');
    const grid = document.querySelector('#calendar-grid');
    if (!grid || !monthLabel) return;
    monthLabel.textContent = formatDate(calendarCursor, { month: 'long', year: 'numeric' });
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12);
    const gridStart = addDays(first, -((first.getDay() + 6) % 7));
    grid.innerHTML = '';
    for (let offset = 0; offset < 42; offset += 1) {
      const date = addDays(gridStart, offset);
      const key = dateKey(date);
      const phase = phaseForDate(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = [
        'calendar-day', `phase-${phase.key}`,
        date.getMonth() !== calendarCursor.getMonth() ? 'outside' : '',
        key === dateKey(today) ? 'today' : '',
        key === selectedDate ? 'selected' : '',
        state.logs[key] ? 'has-log' : ''
      ].filter(Boolean).join(' ');
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-label', `${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${phase.label}${state.logs[key] ? ', con registro' : ''}`);
      button.innerHTML = `<span>${date.getDate()}</span>`;
      button.addEventListener('click', () => { selectedDate = key; renderCalendar(); });
      grid.append(button);
    }
    renderSelectedDay();
  }

  function renderSelectedDay() {
    const date = parseDate(selectedDate);
    const phase = phaseForDate(date);
    const log = state.logs[selectedDate];
    setText('#selected-phase-pill', `${selectedDate === dateKey(today) ? 'Hoy · ' : ''}${phase.label}`);
    setText('#selected-date', formatDate(date, { day: 'numeric', month: 'long' }));
    const dayText = phase.day ? `Día ${phase.day} del ciclo. ` : '';
    const logCount = log ? [log.flow, log.mood, log.energy, log.stress, log.sexualActivity, log.lhTest, log.pdgTest, log.temperature, log.cervical, log.wristTemperatureDelta, ...(log.symptoms || []), ...(log.foods || [])].filter(value => value !== '' && value !== null && value !== undefined).length : 0;
    const logText = log ? ` Hay ${logCount} señales guardadas.` : '';
    let riskText = '';
    if (log?.sexualActivity === 'unprotected') {
      const risk = pregnancyRiskForDate(date, log);
      riskText = risk.calculable ? ` Probabilidad orientativa por la relación: ${formatRiskPercent(risk.probability)}.` : ` ${risk.reason}`;
    }
    setText('#selected-phase-copy', dayText + phase.copy + logText + riskText);
    const model = predictionModel();
    setText('#model-score', model.confidence ? `${model.confidence}%` : '—');
    const meter = document.querySelector('#model-meter');
    if (meter) meter.style.width = `${model.confidence}%`;
    setText('#model-data-note', model.observed.length
      ? `Basada en ${model.observed.length} ciclos completos y una variación de ±${model.window} ${model.window === 1 ? 'día' : 'días'}.`
      : 'Aún usamos una referencia inicial. Confirma dos periodos para personalizarla.');
  }

  function renderInsights() {
    const model = predictionModel();
    const cycles = model.observed;
    const periodLogs = Object.values(state.logs).filter(log => ['light', 'medium', 'heavy'].includes(log.flow));
    setText('#metric-cycle', `${cycles.length ? Math.round(mean(cycles)) : model.baseLength} días`);
    setText('#metric-period', `${periodLogs.length ? state.profile.periodLength : state.profile.periodLength} días`);
    setText('#metric-variation', `±${model.window} días`);
    setText('#metric-count', cycles.length);
    setText('#metric-cycle-sub', cycles.length ? 'Calculado con tus inicios confirmados' : 'Estimación inicial; faltan ciclos completos');
    setText('#metric-variation-sub', model.confidence >= 75 ? 'Predicción de confianza alta' : model.confidence >= 55 ? 'Predicción de confianza media' : 'Confianza baja: registra más ciclos');
    setText('#average-badge', `media ${cycles.length ? Math.round(mean(cycles)) : model.baseLength} d`);
    const chart = document.querySelector('#cycle-chart');
    if (chart) {
      chart.innerHTML = '';
      if (!cycles.length) {
        chart.innerHTML = '<p class="empty-state">Cuando confirmes dos inicios de periodo, aquí aparecerá la duración real de tus ciclos.</p>';
      } else {
        const recent = cycles.slice(-6);
        const min = Math.max(15, Math.min(...recent) - 3);
        const max = Math.max(...recent) + 3;
        recent.forEach((days, index) => {
          const wrap = document.createElement('div');
          wrap.className = 'cycle-bar-wrap';
          const height = 32 + ((days - min) / Math.max(1, max - min)) * 68;
          wrap.innerHTML = `<div class="cycle-bar" style="--height:${height}%"><span>${days} d</span></div><small>C${cycles.length - recent.length + index + 1}</small>`;
          chart.append(wrap);
        });
      }
    }
    const counts = {};
    Object.values(state.logs).forEach(log => (log.symptoms || []).forEach(symptom => { counts[symptom] = (counts[symptom] || 0) + 1; }));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const list = document.querySelector('#symptom-list');
    if (list) {
      list.innerHTML = ranked.length ? '' : '<p class="empty-state">Registra síntomas varios días para descubrir patrones.</p>';
      const maximum = ranked[0]?.[1] || 1;
      ranked.forEach(([symptom, count]) => {
        const row = document.createElement('div');
        row.className = 'symptom-row';
        row.innerHTML = `<span>${escapeHtml(symptomLabels[symptom] || symptom)}</span><div><i style="--width:${Math.round(count / maximum * 100)}%"></i></div><b>${count}</b>`;
        list.append(row);
      });
    }
    const phasesPaused = ['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context);
    setText('#insight-model-confidence', phasesPaused ? '—' : `${model.ovulation.confidence}%`);
    setText('#insight-model-window', phasesPaused
      ? 'La estimación de ovulación está pausada para el contexto seleccionado.'
      : `Ovulación probable: días ${model.ovulation.lowDay}–${model.ovulation.highDay} del ciclo · fase lútea personal ${model.lutealLength} días.`);
    renderSignalTags('#insight-model-signals', phasesPaused ? { ...model.ovulation, signalTypes: [] } : model.ovulation);
    renderHormoneChart();
  }

  function renderHormoneChart() {
    const canvas = document.querySelector('#hormone-chart');
    if (!canvas) return;
    const context = hormoneContextForDate(today);
    const wrapper = canvas.parentElement;
    const width = Math.max(220, (wrapper?.clientWidth || 908) - 8);
    const height = 275;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (!context) {
      const currentPhase = phaseForDate(today);
      setText('#hormone-chart-stage', currentPhase.key === 'uncertain' ? 'Fase incierta' : 'Modelo pausado');
      setText('#hormone-chart-copy', currentPhase.key === 'uncertain'
        ? 'El ciclo superó la ventana prevista o el contexto requiere señales directas; el gráfico se pausa para no inventar un nuevo ciclo.'
        : 'En el contexto seleccionado no se estima un patrón hormonal ovulatorio natural.');
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--muted');
      ctx.font = '12px system-ui';
      ctx.fillText('Modelo de fase no aplicable al contexto seleccionado.', 24, height / 2);
      return;
    }
    const styles = getComputedStyle(document.documentElement);
    const line = styles.getPropertyValue('--line').trim() || '#e7dfd7';
    const muted = styles.getPropertyValue('--muted').trim() || '#7e7472';
    const padding = { left: 34, right: 14, top: 14, bottom: 28 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    ctx.lineWidth = 1;
    ctx.font = '9px system-ui';
    ctx.fillStyle = muted;
    [0, 25, 50, 75, 100].forEach(value => {
      const y = padding.top + chartHeight * (1 - value / 100);
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
      if (value === 0 || value === 50 || value === 100) ctx.fillText(String(value), 7, y + 3);
    });
    const xForDay = day => padding.left + ((day - 1) / Math.max(1, context.length - 1)) * chartWidth;
    Object.keys(hormoneLabels).forEach(key => {
      const lowKey = `${key}Low`;
      const highKey = `${key}High`;
      ctx.fillStyle = hormoneColors[key];
      ctx.globalAlpha = .075;
      ctx.beginPath();
      context.series.forEach((point, index) => {
        const x = xForDay(point.day);
        const y = padding.top + chartHeight * (1 - point[highKey] / 100);
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      [...context.series].reverse().forEach(point => {
        const x = xForDay(point.day);
        const y = padding.top + chartHeight * (1 - point[lowKey] / 100);
        ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = hormoneColors[key];
      ctx.lineWidth = key === 'estradiol' || key === 'progesterone' ? 2.4 : 1.8;
      ctx.beginPath();
      context.series.forEach((point, index) => {
        const x = xForDay(point.day);
        const y = padding.top + chartHeight * (1 - point[key] / 100);
        if (!index) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    const todayX = xForDay(context.day);
    ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(todayX, padding.top); ctx.lineTo(todayX, padding.top + chartHeight); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = muted; ctx.fillText(`día ${context.day}`, clamp(todayX - 14, padding.left, width - 52), height - 8);
    setText('#hormone-chart-stage', `Hoy · ${context.stage.label}`);
    setText('#hormone-chart-copy', `Ciclo estimado de ${context.length} días; las bandas suaves muestran el intervalo posterior del 80%. Cada hormona está normalizada por separado: no compares alturas ni las interpretes como concentraciones.`);
  }

  function renderSettings() {
    const lastStart = [...state.periodStarts].sort().at(-1) || '';
    setValue('#last-period-input', lastStart);
    document.querySelector('#last-period-input').max = dateKey(today);
    setValue('#cycle-length-input', state.profile.averageCycle);
    setValue('#period-length-input', state.profile.periodLength);
    setValue('#cycle-context', state.profile.context);
    setValue('#cycle-pattern', state.profile.cyclePattern || 'auto');
    setChecked('#reminder-daily', state.settings.reminders.daily);
    setChecked('#reminder-biomarkers', state.settings.reminders.biomarkers);
    setChecked('#reminder-period', state.settings.reminders.period);
    setChecked('#reminder-fertile', state.settings.reminders.fertile);
    setChecked('#reminder-health', state.settings.reminders.health);
    setValue('#reminder-time', state.settings.reminders.time);
    setChecked('#discreet-mode', state.settings.discreet);
    setValue('#diet-type', state.nutrition.dietType);
    setValue('#allergy-other', state.nutrition.allergyOther);
    setValue('#intolerance-other', state.nutrition.intoleranceOther);
    setChecked('#celiac-condition', state.nutrition.celiac);
    document.querySelectorAll('#allergy-options input[type="checkbox"]').forEach(input => { input.checked = state.nutrition.allergies.includes(input.value); });
    document.querySelectorAll('#intolerance-options input[type="checkbox"]').forEach(input => { input.checked = state.nutrition.intolerances.includes(input.value); });
    document.querySelectorAll('[data-theme]').forEach(button => button.classList.toggle('active', button.dataset.theme === state.settings.theme));
    const installButton = document.querySelector('#install-app');
    if (installButton && window.matchMedia('(display-mode: standalone)').matches) {
      installButton.textContent = 'App instalada';
      installButton.disabled = true;
    }
    const status = document.querySelector('#notification-status');
    if (status && 'Notification' in window && Notification.permission === 'granted') status.textContent = 'Notificaciones activadas. Marea comprueba como máximo un aviso al día mientras está abierta; el modo discreto oculta detalles sensibles.';
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  }
  function setValue(selector, value) { const element = document.querySelector(selector); if (element) element.value = value ?? ''; }
  function setChecked(selector, checked) { const element = document.querySelector(selector); if (element) element.checked = Boolean(checked); }

  function navigate(viewName, updateHash = true) {
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.dataset.view === viewName));
    document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === viewName));
    if (updateHash) {
      const hashMap = { today: '#hoy', calendar: '#calendario', insights: '#tendencias', settings: '#ajustes' };
      history.replaceState(null, '', hashMap[viewName] || '#hoy');
    }
    if (viewName === 'calendar') renderCalendar();
    if (viewName === 'insights') renderInsights();
    if (viewName === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openLog(key = dateKey(today), focusSection) {
    const dialog = document.querySelector('#log-dialog');
    if (!dialog) return;
    const safeKey = parseDate(key) > today ? dateKey(today) : key;
    selectedDate = safeKey;
    setValue('#log-date', safeKey);
    document.querySelector('#log-date').max = dateKey(today);
    document.querySelector('#emergency-taken-at').max = formatDateTimeLocal();
    fillLogForm(safeKey);
    dialog.showModal();
    if (focusSection) setTimeout(() => dialog.querySelector(`[data-log-section="${focusSection}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  function fillLogForm(key) {
    const log = state.logs[key] || {};
    document.querySelectorAll('[data-choice] button').forEach(button => {
      const choice = button.closest('[data-choice]');
      const group = choice.dataset.choice;
      const selected = choice.classList.contains('multi') ? (log[group] || []).includes(button.dataset.value) : log[group] === button.dataset.value;
      button.classList.toggle('selected', selected);
    });
    setChecked('#period-start', state.periodStarts.includes(key));
    setValue('#energy', log.energy ?? '');
    setValue('#stress', log.stress ?? '');
    setValue('#sleep', log.sleep || '');
    setChecked('#low-interest', log.lowInterest);
    setChecked('#daily-impact', log.dailyImpact);
    setChecked('#safety-concern', log.safetyConcern);
    setValue('#food-note', log.foodNote || '');
    setValue('#temperature', log.temperature || '');
    setValue('#temperature-time', log.temperatureTime || '07:00');
    setValue('#cervical', log.cervical || '');
    setValue('#cervical-sensation', log.cervicalSensation || '');
    setValue('#lh-test', log.lhTest || '');
    setValue('#lh-time', log.lhTime || '');
    setValue('#pdg-test', log.pdgTest || '');
    setValue('#wrist-temp-delta', log.wristTemperatureDelta ?? '');
    setValue('#resting-heart-rate', log.restingHeartRate ?? '');
    setValue('#hrv', log.hrv ?? '');
    setValue('#protection-method', log.protectionMethod || 'condom');
    setValue('#emergency-method', log.emergencyMethod || 'none');
    setValue('#sexual-time', log.sexualTime || '');
    setValue('#emergency-taken-at', log.emergencyTakenAt || '');
    setValue('#note', log.note || '');
    updateSexualActivityFields();
    updateFoodLogWarning();
  }

  function selectedChoice(group) {
    return document.querySelector(`[data-choice="${group}"] .selected`)?.dataset.value || '';
  }

  function selectedChoices(group) {
    return [...document.querySelectorAll(`[data-choice="${group}"] .selected`)].map(button => button.dataset.value);
  }

  function updateFoodLogWarning() {
    const warning = document.querySelector('#food-log-warning');
    if (!warning) return;
    const safety = foodSafetyForLog({ foods: selectedChoices('foods'), foodNote: document.querySelector('#food-note')?.value || '' });
    const parts = [];
    if (safety.allergyHits.length) parts.push(`Alergia registrada: ${safety.allergyHits.map(item => foodLabels[item] || item).join(', ')}. No consumas más y comprueba la etiqueta. Si aparecen signos graves, usa tu plan prescrito y llama al 112.`);
    if (safety.celiacHits.length) parts.push('Celiaquía registrada: contiene gluten. Evita seguir consumiéndolo y revisa ingredientes y contacto cruzado; no se trata como una alerta de anafilaxia.');
    if (safety.intoleranceHits.length) parts.push(`Intolerancia registrada: ${safety.intoleranceHits.map(item => foodLabels[item] || item).join(', ')}. Marea no conoce tu cantidad tolerada.`);
    if (safety.dietConflicts.length) parts.push(`No coincide con tu dieta: ${safety.dietConflicts.map(item => foodLabels[item] || item).join(', ')}.`);
    warning.hidden = !parts.length;
    const paragraph = warning.querySelector('p');
    if (paragraph) paragraph.textContent = parts.join(' ');
  }

  function updateSexualActivityFields() {
    const activity = selectedChoice('sexualActivity');
    const sexualTimeField = document.querySelector('#sexual-time-field');
    const protectionField = document.querySelector('#protection-method-field');
    const emergencyField = document.querySelector('#emergency-method-field');
    const emergencyTimeField = document.querySelector('#emergency-time-field');
    if (sexualTimeField) sexualTimeField.hidden = !activity || activity === 'none';
    if (protectionField) protectionField.hidden = activity !== 'protected';
    if (emergencyField) emergencyField.hidden = activity !== 'unprotected';
    if (emergencyTimeField) emergencyTimeField.hidden = activity !== 'unprotected' || document.querySelector('#emergency-method')?.value === 'none';
    renderPregnancyRiskPreview();
  }

  function renderPregnancyRiskPreview() {
    const preview = document.querySelector('#pregnancy-risk-preview');
    if (!preview) return;
    const activity = selectedChoice('sexualActivity');
    preview.hidden = activity !== 'unprotected';
    if (activity !== 'unprotected') return;
    const key = document.querySelector('#log-date').value;
    if (!isDateKey(key)) return;
    const risk = pregnancyRiskForDate(parseDate(key), { sexualTime: document.querySelector('#sexual-time')?.value || '' });
    const emergencyMethod = document.querySelector('#emergency-method').value;
    const emergencyTakenAt = document.querySelector('#emergency-taken-at')?.value;
    if (!risk.calculable) {
      setText('#risk-preview-value', 'No calculable');
      setText('#risk-preview-range', risk.reason);
      setText('#risk-preview-explanation', 'No interpretes el calendario como protección. Consulta si hubo un fallo del método o tienes dudas.');
      document.querySelector('#risk-track-fill').style.width = '0%';
      document.querySelector('#emergency-guidance').hidden = true;
      return;
    }
    setText('#risk-preview-value', `≈ ${formatRiskPercent(risk.probability)}`);
    setText('#risk-preview-range', `Intervalo orientativo: ${formatRiskPercent(risk.low)}–${formatRiskPercent(risk.high)} · confianza limitada ${risk.confidence}%.`);
    setText('#risk-preview-explanation', emergencyMethod !== 'none'
      ? `Estimación previa a la anticoncepción de emergencia registrada (${emergencyLabels[emergencyMethod]}${emergencyTakenAt ? ` · ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(emergencyTakenAt))}` : ''}). Marea no descuenta una eficacia fija porque depende del momento y del contexto clínico.`
      : `Riesgo ${risk.category} según la distribución posible de ovulación${risk.signals.length ? ` y ${risk.signals.length} tipo${risk.signals.length === 1 ? '' : 's'} de biomarcador` : ''}. Prueba orientativa a partir del ${formatDate(risk.testDate, { day: 'numeric', month: 'long' })}.`);
    document.querySelector('#risk-track-fill').style.width = `${clamp(risk.probability / 33 * 100, 1, 100)}%`;
    document.querySelector('#emergency-guidance').hidden = !(risk.urgent && emergencyMethod === 'none');
  }

  function saveLog() {
    const key = document.querySelector('#log-date').value;
    if (!isDateKey(key)) return;
    const symptoms = [...document.querySelectorAll('[data-choice="symptoms"] .selected')].map(button => button.dataset.value);
    const existing = state.logs[key] || {};
    const sexualActivity = selectedChoice('sexualActivity');
    const emergencyInput = document.querySelector('#emergency-taken-at').value;
    const emergencyTakenAt = emergencyInput && new Date(emergencyInput) <= new Date() ? emergencyInput : '';
    const log = {
      flow: selectedChoice('flow'), mood: selectedChoice('mood'), symptoms,
      sexualActivity,
      sexualTime: sexualActivity && sexualActivity !== 'none' ? document.querySelector('#sexual-time').value : '',
      protectionMethod: sexualActivity === 'protected' ? document.querySelector('#protection-method').value : '',
      emergencyMethod: sexualActivity === 'unprotected' ? document.querySelector('#emergency-method').value : '',
      emergencyTakenAt: sexualActivity === 'unprotected' && document.querySelector('#emergency-method').value !== 'none' ? emergencyTakenAt : '',
      energy: Number(document.querySelector('#energy').value) || null,
      stress: Number(document.querySelector('#stress').value) || null,
      sleep: Number(document.querySelector('#sleep').value) || null,
      lowInterest: document.querySelector('#low-interest').checked,
      dailyImpact: document.querySelector('#daily-impact').checked,
      safetyConcern: document.querySelector('#safety-concern').checked,
      foods: selectedChoices('foods'),
      foodNote: document.querySelector('#food-note').value.trim(),
      temperature: Number(document.querySelector('#temperature').value) || null,
      temperatureTime: document.querySelector('#temperature').value ? document.querySelector('#temperature-time').value : '',
      temperatureFactors: selectedChoices('temperatureFactors'),
      cervical: document.querySelector('#cervical').value,
      cervicalSensation: document.querySelector('#cervical-sensation').value,
      lhTest: document.querySelector('#lh-test').value,
      lhTime: document.querySelector('#lh-test').value ? document.querySelector('#lh-time').value : '',
      pdgTest: document.querySelector('#pdg-test').value,
      wristTemperatureDelta: Number(document.querySelector('#wrist-temp-delta').value) || null,
      restingHeartRate: Number(document.querySelector('#resting-heart-rate').value) || null,
      hrv: Number(document.querySelector('#hrv').value) || null,
      note: document.querySelector('#note').value.trim(),
      updatedAt: new Date().toISOString()
    };
    const meaningful = log.flow || log.mood || log.symptoms.length || log.sexualActivity || log.energy || log.stress || log.sleep || log.lowInterest || log.dailyImpact || log.safetyConcern || log.foods.length || log.foodNote || log.temperature || log.cervical || log.cervicalSensation || log.lhTest || log.pdgTest || log.wristTemperatureDelta || log.restingHeartRate || log.hrv || log.note;
    if (meaningful) state.logs[key] = log; else delete state.logs[key];
    const isPeriodStart = document.querySelector('#period-start').checked;
    if (isPeriodStart && !state.periodStarts.includes(key)) state.periodStarts.push(key);
    if (!isPeriodStart && state.periodStarts.includes(key) && existing) state.periodStarts = state.periodStarts.filter(item => item !== key);
    if (isPeriodStart) state.profile.configured = true;
    state.periodStarts = [...new Set(state.periodStarts)].sort();
    saveState();
    document.querySelector('#log-dialog').close();
    renderAll();
    const risk = sexualActivity === 'unprotected' ? pregnancyRiskForDate(parseDate(key), log) : null;
    const foodSafety = foodSafetyForLog(log);
    showToast(log.safetyConcern
      ? 'Registro guardado. Si temes hacerte daño, llama al 024; ante peligro inmediato, al 112.'
      : foodSafety.allergyHits.length
        ? 'Registro guardado. Revisa la alerta de posible alérgeno.'
        : foodSafety.celiacHits.length
          ? 'Registro guardado. Revisa el aviso de gluten y celiaquía.'
        : risk?.urgent && log.emergencyMethod === 'none'
          ? 'Registro guardado. Si no deseas embarazo, consulta hoy sobre anticoncepción de emergencia.'
          : 'Registro guardado en este dispositivo');
    if (log.safetyConcern) setTimeout(() => document.querySelector('#health-model-dialog')?.showModal(), 250);
  }

  function saveCycleSettings() {
    const start = document.querySelector('#last-period-input').value;
    const validStart = start && parseDate(start) <= today ? start : '';
    const averageCycle = clamp(Number(document.querySelector('#cycle-length-input').value) || 29, 15, 60);
    const periodLength = clamp(Number(document.querySelector('#period-length-input').value) || 5, 1, 14);
    state.profile = {
      ...state.profile, averageCycle, periodLength,
      context: document.querySelector('#cycle-context').value,
      cyclePattern: document.querySelector('#cycle-pattern').value,
      configured: Boolean(validStart || state.periodStarts.length)
    };
    if (validStart && !state.periodStarts.includes(validStart)) state.periodStarts.push(validStart);
    state.periodStarts = [...new Set(state.periodStarts)].sort();
    saveState();
    renderAll();
    showToast('Predicción actualizada');
  }

  function saveNutritionSettings() {
    state.nutrition = {
      configured: true,
      dietType: document.querySelector('#diet-type').value,
      allergies: [...document.querySelectorAll('#allergy-options input:checked')].map(input => input.value),
      allergyOther: document.querySelector('#allergy-other').value.trim(),
      intolerances: [...document.querySelectorAll('#intolerance-options input:checked')].map(input => input.value),
      intoleranceOther: document.querySelector('#intolerance-other').value.trim(),
      celiac: document.querySelector('#celiac-condition').checked
    };
    saveState();
    renderAll();
    showToast('Perfil alimentario guardado y aplicado a las sugerencias');
  }

  function applyTheme() {
    const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = dark ? '#1c191a' : '#f4f0ea';
    document.querySelectorAll('.theme-toggle').forEach(button => button.textContent = dark ? '☀' : '☾');
  }

  function setTheme(theme) {
    state.settings.theme = theme;
    saveState();
    applyTheme();
    renderSettings();
  }

  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      showToast('Este navegador no admite notificaciones de la PWA');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Permiso de notificaciones no concedido');
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(state.settings.discreet ? 'Recordatorio de Marea' : 'Marea está lista', {
      body: state.settings.discreet ? 'Tienes un recordatorio personal.' : 'Tus recordatorios se mostrarán de forma privada.',
      icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'marea-welcome'
    });
    state.notificationHistory.any = dateKey(today);
    saveState();
    renderSettings();
    showToast('Notificaciones activadas');
  }

  async function checkDueReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    const [hour, minute] = state.settings.reminders.time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return;
    const key = dateKey(today);
    if (state.notificationHistory.any === key) return;
    let title = '';
    let body = '';
    let tag = '';
    const healthStatus = healthPatternStatus();
    const lastHealthNotification = isDateKey(state.notificationHistory.health) ? parseDate(state.notificationHistory.health) : null;
    const healthCooldownOver = !lastHealthNotification || dayDiff(lastHealthNotification, today) >= 7;
    if (state.settings.reminders.health && ['attention', 'checkin', 'urgent'].includes(healthStatus.level) && healthCooldownOver) {
      title = healthStatus.urgent ? 'Ayuda disponible ahora' : 'Un patrón merece tu atención';
      body = healthStatus.urgent ? 'Abre Marea para ver ayuda inmediata.' : 'Tus registros muestran un cambio persistente. Puedes revisar el contexto y valorar una consulta.';
      tag = 'health';
    } else if (state.settings.reminders.daily && !state.logs[key] && state.notificationHistory.daily !== key) {
      title = 'Un minuto para ti'; body = '¿Cómo te has sentido hoy?'; tag = 'daily';
    } else if (state.settings.reminders.biomarkers && !state.logs[key]?.lhTest && !state.logs[key]?.temperature && state.notificationHistory.biomarkers !== key) {
      title = 'Señales para tu modelo'; body = 'Si hoy tienes datos de LH o temperatura, puedes registrarlos en Marea.'; tag = 'biomarkers';
    } else {
      const model = predictionModel();
      const daysToPeriod = dayDiff(today, model.nextStart);
      if (state.settings.reminders.period && daysToPeriod <= 2 && daysToPeriod >= 0 && state.notificationHistory.period !== key) {
        title = 'Tu ventana estimada se acerca'; body = `El próximo periodo podría empezar en ${pluralDays(daysToPeriod)}.`; tag = 'period';
      } else {
        const phase = phaseForDate(today);
        if (state.settings.reminders.fertile && ['fertile', 'ovulation'].includes(phase.key) && state.notificationHistory.fertile !== key) {
          title = 'Contexto de tu ciclo'; body = 'Estás en una ventana fértil estimada. No confirma ovulación.'; tag = 'fertile';
        }
      }
    }
    if (!tag) return;
    if (state.settings.discreet) { title = 'Recordatorio de Marea'; body = 'Tienes un recordatorio personal.'; }
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: `marea-${tag}-${key}`, data: { url: './' } });
    state.notificationHistory[tag] = key;
    state.notificationHistory.any = key;
    saveState();
  }

  function updateReminderSettings() {
    state.settings.reminders = {
      daily: document.querySelector('#reminder-daily').checked,
      biomarkers: document.querySelector('#reminder-biomarkers').checked,
      period: document.querySelector('#reminder-period').checked,
      fertile: document.querySelector('#reminder-fertile').checked,
      health: document.querySelector('#reminder-health').checked,
      time: document.querySelector('#reminder-time').value || '20:30'
    };
    state.settings.discreet = document.querySelector('#discreet-mode').checked;
    saveState();
  }

  function downloadBlob(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportData() {
    const payload = { ...state, exportedAt: new Date().toISOString(), app: 'Marea' };
    downloadBlob(JSON.stringify(payload, null, 2), `marea-copia-${dateKey(today)}.json`, 'application/json');
    showToast('Copia exportada');
  }

  function downloadSignalTemplate() {
    const csv = 'date,temperature,lh_test,pdg_test,cervical,wrist_temp_delta,resting_hr,hrv,sleep_hours\n2026-08-25,36.45,negative,,creamy,0.08,63,48,7.5\n';
    downloadBlob(csv, 'marea-plantilla-senales.csv', 'text/csv;charset=utf-8');
  }

  function parseDelimitedLine(line, delimiter) {
    return line.split(delimiter).map(value => value.trim().replace(/^"|"$/g, ''));
  }

  async function importSignalsCsv(file) {
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) throw new Error('Sin filas');
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = parseDelimitedLine(lines[0], delimiter).map(header => header.toLowerCase());
      if (!headers.includes('date')) throw new Error('Falta date');
      let imported = 0;
      lines.slice(1).forEach(line => {
        const values = parseDelimitedLine(line, delimiter);
        const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
        if (!isDateKey(row.date) || parseDate(row.date) > today) return;
        const log = { ...(state.logs[row.date] || {}) };
        let touched = false;
        const setNumber = (column, key, min, max) => {
          if (row[column] === '') return;
          const value = Number(String(row[column]).replace(',', '.'));
          if (Number.isFinite(value) && value >= min && value <= max) { log[key] = value; touched = true; }
        };
        setNumber('temperature', 'temperature', 34, 42);
        setNumber('wrist_temp_delta', 'wristTemperatureDelta', -5, 5);
        setNumber('resting_hr', 'restingHeartRate', 30, 220);
        setNumber('hrv', 'hrv', 1, 300);
        setNumber('sleep_hours', 'sleep', 0, 24);
        if (['negative', 'positive', 'peak'].includes(row.lh_test)) { log.lhTest = row.lh_test; touched = true; }
        if (['negative', 'positive'].includes(row.pdg_test)) { log.pdgTest = row.pdg_test; touched = true; }
        if (['dry', 'sticky', 'creamy', 'watery', 'eggwhite'].includes(row.cervical)) { log.cervical = row.cervical; touched = true; }
        if (!touched) return;
        log.updatedAt = new Date().toISOString();
        state.logs[row.date] = log;
        imported += 1;
      });
      if (!imported) throw new Error('Sin datos válidos');
      saveState();
      renderAll();
      showToast(`${imported} ${imported === 1 ? 'día importado' : 'días importados'} al modelo`);
    } catch {
      showToast('No se pudo importar: revisa la plantilla y las fechas');
    }
  }

  function exportReport() {
    const model = predictionModel();
    const recentLogs = Object.entries(state.logs).sort(([a], [b]) => b.localeCompare(a)).slice(0, 180);
    const rows = recentLogs.map(([date, log]) => {
      let sexualSummary = sexualActivityLabels[log.sexualActivity] || '—';
      if (log.sexualActivity === 'protected' && log.protectionMethod) sexualSummary += ` · ${protectionLabels[log.protectionMethod] || log.protectionMethod}`;
      if (log.sexualActivity === 'unprotected' && log.emergencyMethod && log.emergencyMethod !== 'none') sexualSummary += ` · Emergencia: ${emergencyLabels[log.emergencyMethod] || log.emergencyMethod}`;
      if (log.sexualActivity === 'unprotected') {
        const risk = pregnancyRiskForDate(parseDate(date), log);
        if (risk.calculable) sexualSummary += ` · Riesgo orientativo ${formatRiskPercent(risk.probability)} (${formatRiskPercent(risk.low)}–${formatRiskPercent(risk.high)})`;
      }
      const biomarkers = [
        log.lhTest ? lhLabels[log.lhTest] : '',
        log.pdgTest ? pdgLabels[log.pdgTest] : '',
        log.temperature ? `T basal ${log.temperature.toFixed?.(2) || log.temperature} °C` : '',
        log.cervical ? `Moco ${log.cervical}` : '',
        log.wristTemperatureDelta ? `T nocturna ${log.wristTemperatureDelta > 0 ? '+' : ''}${log.wristTemperatureDelta} °C` : '',
        log.restingHeartRate ? `Pulso ${log.restingHeartRate}` : '',
        log.hrv ? `HRV ${log.hrv}` : ''
      ].filter(Boolean).join(' · ') || '—';
      const wellbeing = [log.energy ? `Energía ${log.energy}/5` : '', log.stress ? `Estrés ${log.stress}/5` : '', log.sleep ? `Sueño ${log.sleep} h` : '', log.lowInterest ? 'Poco interés' : '', log.dailyImpact ? 'Impacto diario' : ''].filter(Boolean).join(' · ') || '—';
      const food = [(log.foods || []).map(item => foodLabels[item] || item).join(', '), log.foodNote].filter(Boolean).join(' · ') || '—';
      return `<tr><td>${escapeHtml(formatDate(parseDate(date), { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${escapeHtml(flowLabels[log.flow] || '—')}</td><td>${escapeHtml(moodLabels[log.mood] || '—')}</td><td>${escapeHtml(wellbeing)}</td><td>${escapeHtml((log.symptoms || []).map(item => symptomLabels[item] || item).join(', ') || '—')}</td><td>${escapeHtml(food)}</td><td>${escapeHtml(biomarkers)}</td><td>${escapeHtml(sexualSummary)}</td><td>${escapeHtml(log.note || '—')}</td></tr>`;
    }).join('');
    const health = healthPatternStatus();
    const nutrition = state.nutrition.configured
      ? `Dieta ${dietLabels[state.nutrition.dietType] || state.nutrition.dietType}; alergias: ${(state.nutrition.allergies || []).map(item => foodLabels[item] || item).join(', ') || 'ninguna registrada'}${state.nutrition.allergyOther ? `, ${state.nutrition.allergyOther}` : ''}; intolerancias: ${(state.nutrition.intolerances || []).join(', ') || 'ninguna registrada'}${state.nutrition.celiac ? '; celiaquía diagnosticada' : ''}.`
      : 'Perfil alimentario no configurado.';
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe Marea</title><style>body{font:14px system-ui;color:#292324;max-width:1180px;margin:40px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;color:#8e3b52}header{border-bottom:2px solid #8e3b52;padding-bottom:18px}.metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{border:1px solid #ddd;padding:14px;border-radius:12px;min-width:140px}.metric b{display:block;font-size:24px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.note{background:#f7f3ee;padding:14px;border-radius:12px;margin:20px 0}@media print{body{margin:0}.note{break-inside:avoid}}</style><body><header><h1>Informe de ciclo · Marea</h1><p>Generado el ${escapeHtml(formatDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))}. Datos registrados localmente por la persona usuaria.</p></header><h2>Resumen</h2><div class="metrics"><div class="metric">Ciclo estimado<b>${model.baseLength} días</b></div><div class="metric">Variación típica<b>±${model.window} días</b></div><div class="metric">Ciclos completos<b>${model.observed.length}</b></div><div class="metric">Modelo multiseñal<b>${model.ovulation.confidence}%</b></div></div><div class="note"><strong>Seguimiento longitudinal.</strong> ${escapeHtml(health.title)}: ${escapeHtml(health.copy)}</div><div class="note"><strong>Perfil alimentario.</strong> ${escapeHtml(nutrition)}</div><div class="note"><strong>Información, no diagnóstico.</strong> Las fases, curvas relativas y probabilidades son estimaciones estadísticas. Este informe no confirma niveles hormonales, ovulación, embarazo ni ninguna condición médica.</div><h2>Registros recientes</h2><table><thead><tr><th>Fecha</th><th>Flujo</th><th>Ánimo</th><th>Bienestar</th><th>Síntomas</th><th>Alimentación</th><th>Biomarcadores</th><th>Actividad sexual</th><th>Nota</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Aún no hay registros.</td></tr>'}</tbody></table></body></html>`;
    downloadBlob(html, `marea-informe-${dateKey(today)}.html`, 'text/html;charset=utf-8');
    showToast('Informe descargado; puedes imprimirlo como PDF');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || ![1, 2, 3].includes(parsed.version) || !parsed.profile || !parsed.logs || !Array.isArray(parsed.periodStarts)) throw new Error('Formato no reconocido');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      state = loadState();
      modelCache.clear();
      wellbeingCache = null;
      renderAll();
      showToast('Copia importada correctamente');
    } catch {
      showToast('No se pudo importar: el archivo no es una copia válida de Marea');
    }
  }

  async function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      renderSettings();
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    showToast(isIOS ? 'En Safari: Compartir → Añadir a pantalla de inicio' : 'Usa el menú del navegador → Instalar Marea');
  }

  function updateSetupBanner() {
    const banner = document.querySelector('#setup-banner');
    if (banner) banner.classList.toggle('hidden', state.profile.configured || sessionStorage.getItem('marea:hide-setup') === '1');
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function bindEvents() {
    document.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); navigate(link.dataset.nav); }));
    document.querySelectorAll('[data-open-log]').forEach(button => button.addEventListener('click', () => openLog(dateKey(today), button.dataset.openLog || '')));
    document.querySelectorAll('.theme-toggle').forEach(button => button.addEventListener('click', () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')));
    document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => setTheme(button.dataset.theme)));
    document.querySelectorAll('[data-choice] button').forEach(button => button.addEventListener('click', () => {
      const group = button.closest('[data-choice]');
      if (group.classList.contains('multi')) button.classList.toggle('selected');
      else { group.querySelectorAll('button').forEach(item => item.classList.remove('selected')); button.classList.add('selected'); }
      if (group.dataset.choice === 'sexualActivity') updateSexualActivityFields();
      if (group.dataset.choice === 'foods') updateFoodLogWarning();
    }));
    document.querySelector('#log-date')?.addEventListener('change', event => fillLogForm(event.target.value));
    document.querySelector('#emergency-method')?.addEventListener('change', updateSexualActivityFields);
    document.querySelector('#sexual-time')?.addEventListener('change', renderPregnancyRiskPreview);
    document.querySelector('#emergency-taken-at')?.addEventListener('change', renderPregnancyRiskPreview);
    document.querySelector('#food-note')?.addEventListener('input', updateFoodLogWarning);
    document.querySelector('#log-form')?.addEventListener('submit', event => {
      event.preventDefault();
      if (event.submitter?.value === 'cancel') document.querySelector('#log-dialog').close(); else saveLog();
    });
    document.querySelector('#previous-month')?.addEventListener('click', () => { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderCalendar(); });
    document.querySelector('#next-month')?.addEventListener('click', () => { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderCalendar(); });
    document.querySelector('#log-selected-day')?.addEventListener('click', () => openLog(selectedDate));
    document.querySelectorAll('#confidence-button, #open-model, #open-model-2, #open-model-dashboard').forEach(button => button.addEventListener('click', () => document.querySelector('#model-dialog').showModal()));
    document.querySelectorAll('[data-open-pregnancy-model]').forEach(button => button.addEventListener('click', () => document.querySelector('#pregnancy-model-dialog').showModal()));
    document.querySelector('#save-cycle-settings')?.addEventListener('click', saveCycleSettings);
    document.querySelector('#save-nutrition-settings')?.addEventListener('click', saveNutritionSettings);
    document.querySelector('#open-nutrition-settings')?.addEventListener('click', () => { navigate('settings'); setTimeout(() => document.querySelector('#diet-type')?.focus(), 350); });
    document.querySelector('#open-health-model')?.addEventListener('click', () => document.querySelector('#health-model-dialog').showModal());
    ['#reminder-daily', '#reminder-biomarkers', '#reminder-period', '#reminder-fertile', '#reminder-health', '#reminder-time', '#discreet-mode'].forEach(selector => document.querySelector(selector)?.addEventListener('change', updateReminderSettings));
    document.querySelector('#enable-notifications')?.addEventListener('click', enableNotifications);
    document.querySelector('#export-data')?.addEventListener('click', exportData);
    document.querySelector('#download-signal-template')?.addEventListener('click', downloadSignalTemplate);
    document.querySelector('#import-signals')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importSignalsCsv(file); event.target.value = ''; });
    document.querySelector('#export-report')?.addEventListener('click', exportReport);
    document.querySelector('#import-data')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importData(file); event.target.value = ''; });
    document.querySelector('#delete-data')?.addEventListener('click', () => document.querySelector('#confirm-dialog').showModal());
    document.querySelector('#confirm-delete')?.addEventListener('click', event => {
      event.preventDefault(); localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); modelCache.clear(); wellbeingCache = null; document.querySelector('#confirm-dialog').close(); renderAll(); showToast('Todos los datos se han borrado');
    });
    document.querySelector('#install-app')?.addEventListener('click', installApp);
    document.querySelector('#start-setup')?.addEventListener('click', () => { navigate('settings'); setTimeout(() => document.querySelector('#last-period-input')?.focus(), 350); });
    document.querySelector('.close-banner')?.addEventListener('click', () => { sessionStorage.setItem('marea:hide-setup', '1'); updateSetupBanner(); });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });
    window.addEventListener('resize', () => { if (document.querySelector('[data-view="insights"]')?.classList.contains('active')) renderHormoneChart(); });
  }

  async function initPwa() {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('sw.js'); } catch { /* App remains fully usable online. */ }
    }
    checkDueReminders();
    setInterval(checkDueReminders, 60000);
  }

  bindEvents();
  renderAll();
  const hashView = ({ '#hoy': 'today', '#calendario': 'calendar', '#tendencias': 'insights', '#ajustes': 'settings' })[location.hash];
  if (hashView) navigate(hashView, false);
  initPwa();
})();
