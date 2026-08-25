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

  const symptomLabels = {
    cramps: 'Calambres', headache: 'Dolor de cabeza', bloating: 'Hinchazón',
    tenderness: 'Pecho sensible', acne: 'Piel / acné', backache: 'Dolor lumbar',
    fatigue: 'Cansancio', cravings: 'Antojos', insomnia: 'Sueño irregular', nausea: 'Náuseas'
  };
  const moodLabels = { great: 'Genial', calm: 'En calma', sensitive: 'Sensible', low: 'Ánimo bajo', irritable: 'Irritable' };
  const flowLabels = { none: 'Sin flujo', spotting: 'Manchado', light: 'Ligero', medium: 'Medio', heavy: 'Abundante' };
  const sexualActivityLabels = { none: 'Sin actividad', protected: 'Con protección', unprotected: 'Sin protección o fallo' };
  const protectionLabels = { condom: 'Preservativo', pill: 'Píldora', iud: 'DIU', implant: 'Implante', 'ring-patch': 'Anillo o parche', injection: 'Inyección', other: 'Otro método' };
  const emergencyLabels = { none: 'No / sin registrar', levonorgestrel: 'Levonorgestrel', ulipristal: 'Ulipristal', 'copper-iud': 'DIU de cobre' };
  const lhLabels = { negative: 'LH negativo', positive: 'LH positivo', peak: 'Pico de LH' };
  const pdgLabels = { negative: 'PdG negativo', positive: 'PdG positivo' };
  const modelSignalLabels = { lh: 'LH', pdg: 'PdG', bbt: 'Temperatura basal', wrist: 'Temperatura nocturna', mucus: 'Moco cervical', vitals: 'Pulso / HRV' };
  const phaseMeta = {
    menstrual: { label: 'Menstrual', className: 'menstrual', copy: 'Prioriza el descanso y registra cualquier cambio que te llame la atención.' },
    follicular: { label: 'Fase folicular', className: 'follicular', copy: 'Tu energía puede empezar a subir. La ventana fértil se aproxima.' },
    fertile: { label: 'Ventana fértil estimada', className: 'fertile', copy: 'Esta ventana es una estimación estadística, no una confirmación de ovulación.' },
    ovulation: { label: 'Ovulación estimada', className: 'ovulation', copy: 'Día de ovulación más probable dentro de una ventana variable.' },
    luteal: { label: 'Fase lútea', className: 'luteal', copy: 'Observa cambios en sueño, apetito, ánimo o sensibilidad sin asumir que ocurrirán.' },
    tracking: { label: 'Seguimiento', className: 'tracking', copy: 'En tu contexto actual mostramos registros y tendencias, sin asignar fases hormonales.' }
  };

  const defaultState = {
    version: 2,
    profile: { configured: false, averageCycle: 29, periodLength: 5, context: 'natural', cyclePattern: 'auto' },
    periodStarts: [],
    logs: {},
    settings: {
      theme: 'system', discreet: false,
      reminders: { daily: false, biomarkers: false, period: false, fertile: false, time: '20:30' }
    },
    notificationHistory: {}
  };

  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return structuredClone(defaultState);
      return {
        ...structuredClone(defaultState), ...saved,
        version: 2,
        profile: { ...defaultState.profile, ...(saved.profile || {}) },
        settings: {
          ...defaultState.settings, ...(saved.settings || {}),
          reminders: { ...defaultState.settings.reminders, ...(saved.settings?.reminders || {}) }
        },
        periodStarts: Array.isArray(saved.periodStarts) ? saved.periodStarts.filter(isDateKey) : [],
        logs: saved.logs && typeof saved.logs === 'object' ? saved.logs : {},
        notificationHistory: saved.notificationHistory || {}
      };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    modelCache.clear();
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

    if (start) {
      const nextActual = starts.find(item => item > start);
      if (nextActual && date < nextActual) cycleLength = clamp(dayDiff(start, nextActual), 15, 90);
      while (dayDiff(start, date) >= cycleLength) start = addDays(start, cycleLength);
    } else {
      start = starts[0] || model.currentStart;
      while (start > date) start = addDays(start, -cycleLength);
      while (dayDiff(start, date) >= cycleLength) start = addDays(start, cycleLength);
    }
    return { day: dayDiff(start, date) + 1, length: cycleLength, start };
  }

  function phaseForDate(date) {
    if (['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context)) return { key: 'tracking', ...phaseMeta.tracking, day: null, length: null };
    const position = cyclePosition(date);
    const periodLength = clamp(Number(state.profile.periodLength) || 5, 1, 14);
    const posterior = ovulationModelForCycle(position.start, position.length, today);
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
    for (let offset = 1; offset <= 40; offset += 1) {
      const phase = phaseForDate(addDays(date, offset));
      if (phase.key !== currentKey) return { phase, offset };
    }
    return { phase: phaseForDate(addDays(date, 1)), offset: 1 };
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
    setText('#next-phase', `${upcoming.phase.label} · en ${pluralDays(upcoming.offset)}`);
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
    const logCount = log ? [log.flow, log.mood, log.sexualActivity, log.lhTest, log.pdgTest, log.temperature, log.cervical, log.wristTemperatureDelta, ...(log.symptoms || [])].filter(value => value !== '' && value !== null && value !== undefined).length : 0;
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
        row.innerHTML = `<span>${symptomLabels[symptom] || symptom}</span><div><i style="--width:${Math.round(count / maximum * 100)}%"></i></div><b>${count}</b>`;
        list.append(row);
      });
    }
    const phasesPaused = ['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context);
    setText('#insight-model-confidence', phasesPaused ? '—' : `${model.ovulation.confidence}%`);
    setText('#insight-model-window', phasesPaused
      ? 'La estimación de ovulación está pausada para el contexto seleccionado.'
      : `Ovulación probable: días ${model.ovulation.lowDay}–${model.ovulation.highDay} del ciclo · fase lútea personal ${model.lutealLength} días.`);
    renderSignalTags('#insight-model-signals', phasesPaused ? { ...model.ovulation, signalTypes: [] } : model.ovulation);
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
    setValue('#reminder-time', state.settings.reminders.time);
    setChecked('#discreet-mode', state.settings.discreet);
    document.querySelectorAll('[data-theme]').forEach(button => button.classList.toggle('active', button.dataset.theme === state.settings.theme));
    const installButton = document.querySelector('#install-app');
    if (installButton && window.matchMedia('(display-mode: standalone)').matches) {
      installButton.textContent = 'App instalada';
      installButton.disabled = true;
    }
    const status = document.querySelector('#notification-status');
    if (status && 'Notification' in window && Notification.permission === 'granted') status.textContent = 'Notificaciones activadas. Los avisos serán discretos si habilitas el modo correspondiente.';
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
    setValue('#energy', log.energy || 3);
    setValue('#sleep', log.sleep || '');
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
  }

  function selectedChoice(group) {
    return document.querySelector(`[data-choice="${group}"] .selected`)?.dataset.value || '';
  }

  function selectedChoices(group) {
    return [...document.querySelectorAll(`[data-choice="${group}"] .selected`)].map(button => button.dataset.value);
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
      sleep: Number(document.querySelector('#sleep').value) || null,
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
    const meaningful = log.flow || log.mood || log.symptoms.length || log.sexualActivity || log.sleep || log.temperature || log.cervical || log.cervicalSensation || log.lhTest || log.pdgTest || log.wristTemperatureDelta || log.restingHeartRate || log.hrv || log.note;
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
    showToast(risk?.urgent && log.emergencyMethod === 'none'
      ? 'Registro guardado. Si no deseas embarazo, consulta hoy sobre anticoncepción de emergencia.'
      : 'Registro guardado en este dispositivo');
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
    renderSettings();
    showToast('Notificaciones activadas');
  }

  async function checkDueReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    const [hour, minute] = state.settings.reminders.time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return;
    const key = dateKey(today);
    let title = '';
    let body = '';
    let tag = '';
    if (state.settings.reminders.daily && !state.logs[key] && state.notificationHistory.daily !== key) {
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
    saveState();
  }

  function updateReminderSettings() {
    state.settings.reminders = {
      daily: document.querySelector('#reminder-daily').checked,
      biomarkers: document.querySelector('#reminder-biomarkers').checked,
      period: document.querySelector('#reminder-period').checked,
      fertile: document.querySelector('#reminder-fertile').checked,
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
      return `<tr><td>${escapeHtml(formatDate(parseDate(date), { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${escapeHtml(flowLabels[log.flow] || '—')}</td><td>${escapeHtml(moodLabels[log.mood] || '—')}</td><td>${escapeHtml((log.symptoms || []).map(item => symptomLabels[item] || item).join(', ') || '—')}</td><td>${escapeHtml(biomarkers)}</td><td>${escapeHtml(sexualSummary)}</td><td>${escapeHtml(log.note || '—')}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe Marea</title><style>body{font:14px system-ui;color:#292324;max-width:980px;margin:40px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;color:#8e3b52}header{border-bottom:2px solid #8e3b52;padding-bottom:18px}.metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{border:1px solid #ddd;padding:14px;border-radius:12px;min-width:140px}.metric b{display:block;font-size:24px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.note{background:#f7f3ee;padding:14px;border-radius:12px;margin:20px 0}@media print{body{margin:0}.note{break-inside:avoid}}</style><body><header><h1>Informe de ciclo · Marea</h1><p>Generado el ${escapeHtml(formatDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))}. Datos registrados localmente por la persona usuaria.</p></header><h2>Resumen</h2><div class="metrics"><div class="metric">Ciclo estimado<b>${model.baseLength} días</b></div><div class="metric">Variación típica<b>±${model.window} días</b></div><div class="metric">Ciclos completos<b>${model.observed.length}</b></div><div class="metric">Modelo multiseñal<b>${model.ovulation.confidence}%</b></div></div><div class="note"><strong>Información, no diagnóstico.</strong> Las fases y probabilidades son estimaciones estadísticas. Este informe no confirma ovulación, embarazo ni ninguna condición médica.</div><h2>Registros recientes</h2><table><thead><tr><th>Fecha</th><th>Flujo</th><th>Ánimo</th><th>Síntomas</th><th>Biomarcadores</th><th>Actividad sexual</th><th>Nota</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Aún no hay registros.</td></tr>'}</tbody></table></body></html>`;
    downloadBlob(html, `marea-informe-${dateKey(today)}.html`, 'text/html;charset=utf-8');
    showToast('Informe descargado; puedes imprimirlo como PDF');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || ![1, 2].includes(parsed.version) || !parsed.profile || !parsed.logs || !Array.isArray(parsed.periodStarts)) throw new Error('Formato no reconocido');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      state = loadState();
      modelCache.clear();
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
    }));
    document.querySelector('#log-date')?.addEventListener('change', event => fillLogForm(event.target.value));
    document.querySelector('#emergency-method')?.addEventListener('change', updateSexualActivityFields);
    document.querySelector('#sexual-time')?.addEventListener('change', renderPregnancyRiskPreview);
    document.querySelector('#emergency-taken-at')?.addEventListener('change', renderPregnancyRiskPreview);
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
    ['#reminder-daily', '#reminder-biomarkers', '#reminder-period', '#reminder-fertile', '#reminder-time', '#discreet-mode'].forEach(selector => document.querySelector(selector)?.addEventListener('change', updateReminderSettings));
    document.querySelector('#enable-notifications')?.addEventListener('click', enableNotifications);
    document.querySelector('#export-data')?.addEventListener('click', exportData);
    document.querySelector('#download-signal-template')?.addEventListener('click', downloadSignalTemplate);
    document.querySelector('#import-signals')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importSignalsCsv(file); event.target.value = ''; });
    document.querySelector('#export-report')?.addEventListener('click', exportReport);
    document.querySelector('#import-data')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importData(file); event.target.value = ''; });
    document.querySelector('#delete-data')?.addEventListener('click', () => document.querySelector('#confirm-dialog').showModal());
    document.querySelector('#confirm-delete')?.addEventListener('click', event => {
      event.preventDefault(); localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); modelCache.clear(); document.querySelector('#confirm-dialog').close(); renderAll(); showToast('Todos los datos se han borrado');
    });
    document.querySelector('#install-app')?.addEventListener('click', installApp);
    document.querySelector('#start-setup')?.addEventListener('click', () => { navigate('settings'); setTimeout(() => document.querySelector('#last-period-input')?.focus(), 350); });
    document.querySelector('.close-banner')?.addEventListener('click', () => { sessionStorage.setItem('marea:hide-setup', '1'); updateSetupBanner(); });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstallPrompt = event; });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.settings.theme === 'system') applyTheme(); });
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
