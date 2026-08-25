(() => {
  'use strict';

  const STORAGE_KEY = 'marea:data:v1';
  const DAY_MS = 86400000;
  const today = startOfDay(new Date());
  let calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  let selectedDate = dateKey(today);
  let deferredInstallPrompt = null;
  let toastTimer;

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
  const phaseMeta = {
    menstrual: { label: 'Menstrual', className: 'menstrual', copy: 'Prioriza el descanso y registra cualquier cambio que te llame la atención.' },
    follicular: { label: 'Fase folicular', className: 'follicular', copy: 'Tu energía puede empezar a subir. La ventana fértil se aproxima.' },
    fertile: { label: 'Ventana fértil estimada', className: 'fertile', copy: 'Esta ventana es una estimación estadística, no una confirmación de ovulación.' },
    ovulation: { label: 'Ovulación estimada', className: 'ovulation', copy: 'Día de ovulación más probable dentro de una ventana variable.' },
    luteal: { label: 'Fase lútea', className: 'luteal', copy: 'Observa cambios en sueño, apetito, ánimo o sensibilidad sin asumir que ocurrirán.' },
    tracking: { label: 'Seguimiento', className: 'tracking', copy: 'En tu contexto actual mostramos registros y tendencias, sin asignar fases hormonales.' }
  };

  const defaultState = {
    version: 1,
    profile: { configured: false, averageCycle: 29, periodLength: 5, context: 'natural' },
    periodStarts: [],
    logs: {},
    settings: {
      theme: 'system', discreet: false,
      reminders: { daily: false, period: false, fertile: false, time: '20:30' }
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
  function pluralDays(days) { return `${days} ${days === 1 ? 'día' : 'días'}`; }

  function observedCycleLengths() {
    const starts = [...new Set(state.periodStarts)].sort();
    return starts.slice(1).map((key, index) => dayDiff(parseDate(starts[index]), parseDate(key))).filter(days => days >= 15 && days <= 90);
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
    if (state.profile.context === 'perimenopause' || state.profile.context === 'postpartum') variability = Math.max(variability, 5);

    const fallbackStart = addDays(today, -8);
    const starts = state.periodStarts.map(parseDate).filter(date => date <= asOf).sort((a, b) => a - b);
    const currentStart = starts.at(-1) || fallbackStart;
    const currentDay = Math.max(1, dayDiff(currentStart, asOf) + 1);
    const adjustedLength = currentDay >= baseLength ? Math.min(90, currentDay + Math.max(1, Math.ceil(variability * .7))) : baseLength;
    const nextStart = addDays(currentStart, adjustedLength);
    const window = clamp(Math.ceil(variability * .8), 1, 10);
    let confidence = clamp(Math.round(50 + usable.length * 8 - variability * 3.2), 32, 94);
    if (!state.profile.configured) confidence = 36;
    if (['hormonal', 'pregnant', 'postpartum'].includes(state.profile.context)) confidence = 0;
    if (state.profile.context === 'perimenopause') confidence = Math.min(confidence, 58);

    return { observed, prior, baseLength, adjustedLength, variability, currentStart, currentDay, nextStart, window, confidence };
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
    const ovulationDay = clamp(position.length - 14, periodLength + 2, position.length - 7);
    let key = 'luteal';
    if (position.day <= periodLength) key = 'menstrual';
    else if (position.day === ovulationDay) key = 'ovulation';
    else if (position.day >= ovulationDay - 5 && position.day <= ovulationDay + 1) key = 'fertile';
    else if (position.day < ovulationDay - 5) key = 'follicular';
    return { key, ...phaseMeta[key], ...position, ovulationDay };
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

  function pregnancyRiskForDate(date) {
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
    const model = predictionModel();
    const periodLength = clamp(Number(state.profile.periodLength) || 5, 1, 14);
    const estimatedOvulationDay = clamp(position.length - 14, periodLength + 2, position.length - 7);
    const dataPenalty = model.observed.length >= 3 ? 0 : (3 - model.observed.length) * .55;
    const ovulationSd = clamp(1.45 + model.variability * .55 + dataPenalty + (context === 'perimenopause' ? 2 : 0), 1.7, 8);
    let weightedProbability = 0;
    let totalWeight = 0;
    const firstPossibleDay = Math.max(periodLength + 1, estimatedOvulationDay - 15);
    const lastPossibleDay = Math.min(position.length - 5, estimatedOvulationDay + 15);
    for (let ovulationDay = firstPossibleDay; ovulationDay <= lastPossibleDay; ovulationDay += 1) {
      const z = (ovulationDay - estimatedOvulationDay) / ovulationSd;
      const weight = Math.exp(-.5 * z * z);
      const intercourseOffset = position.day - ovulationDay;
      weightedProbability += weight * fecundabilityForOffset(intercourseOffset);
      totalWeight += weight;
    }
    const probability = clamp((weightedProbability / Math.max(totalWeight, .001)) * 100, 0, 33);
    const uncertainty = clamp(.34 + ovulationSd * .055, .42, .82);
    const low = clamp(probability * (1 - uncertainty), 0, 33);
    const high = clamp(probability * (1 + uncertainty) + .6, .6, 33);
    const confidence = clamp(Math.round(model.confidence * .62 + Math.min(model.observed.length, 6) * 2), 20, 68);
    const daysSince = dayDiff(date, today);
    return {
      calculable: true, probability, low, high, confidence, daysSince,
      urgent: daysSince >= 0 && daysSince <= 5,
      testDate: addDays(date, 21),
      ovulationSd,
      category: probability < 2 ? 'muy baja' : probability < 8 ? 'baja' : probability < 18 ? 'moderada' : 'alta'
    };
  }

  function formatRiskPercent(value) {
    if (value < .1) return '<0,1%';
    if (value < 10) return `${value.toFixed(1).replace('.', ',')}%`;
    return `${Math.round(value)}%`;
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
    setText('#quick-note', log.note ? log.note.slice(0, 38) : 'Escribe lo que quieras');
    const riskCard = document.querySelector('#daily-risk-card');
    if (riskCard) {
      const showRisk = log.sexualActivity === 'unprotected';
      riskCard.hidden = !showRisk;
      if (showRisk) {
        const risk = pregnancyRiskForDate(today);
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
    const logCount = log ? [log.flow, log.mood, log.sexualActivity, ...(log.symptoms || [])].filter(Boolean).length : 0;
    const logText = log ? ` Hay ${logCount} señales guardadas.` : '';
    let riskText = '';
    if (log?.sexualActivity === 'unprotected') {
      const risk = pregnancyRiskForDate(date);
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
  }

  function renderSettings() {
    const lastStart = [...state.periodStarts].sort().at(-1) || '';
    setValue('#last-period-input', lastStart);
    setValue('#cycle-length-input', state.profile.averageCycle);
    setValue('#period-length-input', state.profile.periodLength);
    setValue('#cycle-context', state.profile.context);
    setChecked('#reminder-daily', state.settings.reminders.daily);
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
    fillLogForm(safeKey);
    dialog.showModal();
    if (focusSection) setTimeout(() => dialog.querySelector(`[data-log-section="${focusSection}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }

  function fillLogForm(key) {
    const log = state.logs[key] || {};
    document.querySelectorAll('[data-choice] button').forEach(button => {
      const group = button.closest('[data-choice]').dataset.choice;
      const selected = group === 'symptoms' ? (log.symptoms || []).includes(button.dataset.value) : log[group] === button.dataset.value;
      button.classList.toggle('selected', selected);
    });
    setChecked('#period-start', state.periodStarts.includes(key));
    setValue('#energy', log.energy || 3);
    setValue('#sleep', log.sleep || '');
    setValue('#temperature', log.temperature || '');
    setValue('#cervical', log.cervical || '');
    setValue('#protection-method', log.protectionMethod || 'condom');
    setValue('#emergency-method', log.emergencyMethod || 'none');
    setValue('#note', log.note || '');
    updateSexualActivityFields();
  }

  function selectedChoice(group) {
    return document.querySelector(`[data-choice="${group}"] .selected`)?.dataset.value || '';
  }

  function updateSexualActivityFields() {
    const activity = selectedChoice('sexualActivity');
    const protectionField = document.querySelector('#protection-method-field');
    const emergencyField = document.querySelector('#emergency-method-field');
    if (protectionField) protectionField.hidden = activity !== 'protected';
    if (emergencyField) emergencyField.hidden = activity !== 'unprotected';
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
    const risk = pregnancyRiskForDate(parseDate(key));
    const emergencyMethod = document.querySelector('#emergency-method').value;
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
      ? `Estimación previa a la anticoncepción de emergencia registrada (${emergencyLabels[emergencyMethod]}). Marea no ajusta el porcentaje porque la eficacia depende del momento y del contexto clínico.`
      : `Riesgo ${risk.category} según la distribución posible de ovulación. Prueba orientativa a partir del ${formatDate(risk.testDate, { day: 'numeric', month: 'long' })}.`);
    document.querySelector('#risk-track-fill').style.width = `${clamp(risk.probability / 33 * 100, 1, 100)}%`;
    document.querySelector('#emergency-guidance').hidden = !(risk.urgent && emergencyMethod === 'none');
  }

  function saveLog() {
    const key = document.querySelector('#log-date').value;
    if (!isDateKey(key)) return;
    const symptoms = [...document.querySelectorAll('[data-choice="symptoms"] .selected')].map(button => button.dataset.value);
    const existing = state.logs[key] || {};
    const sexualActivity = selectedChoice('sexualActivity');
    const log = {
      flow: selectedChoice('flow'), mood: selectedChoice('mood'), symptoms,
      sexualActivity,
      protectionMethod: sexualActivity === 'protected' ? document.querySelector('#protection-method').value : '',
      emergencyMethod: sexualActivity === 'unprotected' ? document.querySelector('#emergency-method').value : '',
      energy: Number(document.querySelector('#energy').value) || null,
      sleep: Number(document.querySelector('#sleep').value) || null,
      temperature: Number(document.querySelector('#temperature').value) || null,
      cervical: document.querySelector('#cervical').value,
      note: document.querySelector('#note').value.trim(),
      updatedAt: new Date().toISOString()
    };
    const meaningful = log.flow || log.mood || log.symptoms.length || log.sexualActivity || log.sleep || log.temperature || log.cervical || log.note;
    if (meaningful) state.logs[key] = log; else delete state.logs[key];
    const isPeriodStart = document.querySelector('#period-start').checked;
    if (isPeriodStart && !state.periodStarts.includes(key)) state.periodStarts.push(key);
    if (!isPeriodStart && state.periodStarts.includes(key) && existing) state.periodStarts = state.periodStarts.filter(item => item !== key);
    if (isPeriodStart) state.profile.configured = true;
    state.periodStarts = [...new Set(state.periodStarts)].sort();
    saveState();
    document.querySelector('#log-dialog').close();
    renderAll();
    const risk = sexualActivity === 'unprotected' ? pregnancyRiskForDate(parseDate(key)) : null;
    showToast(risk?.urgent && log.emergencyMethod === 'none'
      ? 'Registro guardado. Si no deseas embarazo, consulta hoy sobre anticoncepción de emergencia.'
      : 'Registro guardado en este dispositivo');
  }

  function saveCycleSettings() {
    const start = document.querySelector('#last-period-input').value;
    const averageCycle = clamp(Number(document.querySelector('#cycle-length-input').value) || 29, 15, 60);
    const periodLength = clamp(Number(document.querySelector('#period-length-input').value) || 5, 1, 14);
    state.profile = {
      ...state.profile, averageCycle, periodLength,
      context: document.querySelector('#cycle-context').value,
      configured: Boolean(start || state.periodStarts.length)
    };
    if (start && !state.periodStarts.includes(start)) state.periodStarts.push(start);
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

  function exportReport() {
    const model = predictionModel();
    const recentLogs = Object.entries(state.logs).sort(([a], [b]) => b.localeCompare(a)).slice(0, 180);
    const rows = recentLogs.map(([date, log]) => {
      let sexualSummary = sexualActivityLabels[log.sexualActivity] || '—';
      if (log.sexualActivity === 'protected' && log.protectionMethod) sexualSummary += ` · ${protectionLabels[log.protectionMethod] || log.protectionMethod}`;
      if (log.sexualActivity === 'unprotected' && log.emergencyMethod && log.emergencyMethod !== 'none') sexualSummary += ` · Emergencia: ${emergencyLabels[log.emergencyMethod] || log.emergencyMethod}`;
      return `<tr><td>${escapeHtml(formatDate(parseDate(date), { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${escapeHtml(flowLabels[log.flow] || '—')}</td><td>${escapeHtml(moodLabels[log.mood] || '—')}</td><td>${escapeHtml((log.symptoms || []).map(item => symptomLabels[item] || item).join(', ') || '—')}</td><td>${escapeHtml(sexualSummary)}</td><td>${escapeHtml(log.note || '—')}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe Marea</title><style>body{font:14px system-ui;color:#292324;max-width:900px;margin:40px auto;padding:0 24px}h1,h2{font-family:Georgia,serif;color:#8e3b52}header{border-bottom:2px solid #8e3b52;padding-bottom:18px}.metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{border:1px solid #ddd;padding:14px;border-radius:12px;min-width:140px}.metric b{display:block;font-size:24px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top}.note{background:#f7f3ee;padding:14px;border-radius:12px;margin:20px 0}@media print{body{margin:0}.note{break-inside:avoid}}</style><body><header><h1>Informe de ciclo · Marea</h1><p>Generado el ${escapeHtml(formatDate(today, { day: 'numeric', month: 'long', year: 'numeric' }))}. Datos registrados localmente por la persona usuaria.</p></header><h2>Resumen</h2><div class="metrics"><div class="metric">Ciclo estimado<b>${model.baseLength} días</b></div><div class="metric">Variación típica<b>±${model.window} días</b></div><div class="metric">Ciclos completos<b>${model.observed.length}</b></div><div class="metric">Periodo orientativo<b>${state.profile.periodLength} días</b></div></div><div class="note"><strong>Información, no diagnóstico.</strong> Las fases y probabilidades son estimaciones estadísticas. Este informe no confirma ovulación, embarazo ni ninguna condición médica.</div><h2>Registros recientes</h2><table><thead><tr><th>Fecha</th><th>Flujo</th><th>Ánimo</th><th>Síntomas</th><th>Actividad sexual</th><th>Nota</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Aún no hay registros.</td></tr>'}</tbody></table></body></html>`;
    downloadBlob(html, `marea-informe-${dateKey(today)}.html`, 'text/html;charset=utf-8');
    showToast('Informe descargado; puedes imprimirlo como PDF');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.version !== 1 || !parsed.profile || !parsed.logs || !Array.isArray(parsed.periodStarts)) throw new Error('Formato no reconocido');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      state = loadState();
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
    document.querySelector('#emergency-method')?.addEventListener('change', renderPregnancyRiskPreview);
    document.querySelector('#log-form')?.addEventListener('submit', event => {
      event.preventDefault();
      if (event.submitter?.value === 'cancel') document.querySelector('#log-dialog').close(); else saveLog();
    });
    document.querySelector('#previous-month')?.addEventListener('click', () => { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderCalendar(); });
    document.querySelector('#next-month')?.addEventListener('click', () => { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderCalendar(); });
    document.querySelector('#log-selected-day')?.addEventListener('click', () => openLog(selectedDate));
    document.querySelectorAll('#confidence-button, #open-model, #open-model-2').forEach(button => button.addEventListener('click', () => document.querySelector('#model-dialog').showModal()));
    document.querySelectorAll('[data-open-pregnancy-model]').forEach(button => button.addEventListener('click', () => document.querySelector('#pregnancy-model-dialog').showModal()));
    document.querySelector('#save-cycle-settings')?.addEventListener('click', saveCycleSettings);
    ['#reminder-daily', '#reminder-period', '#reminder-fertile', '#reminder-time', '#discreet-mode'].forEach(selector => document.querySelector(selector)?.addEventListener('change', updateReminderSettings));
    document.querySelector('#enable-notifications')?.addEventListener('click', enableNotifications);
    document.querySelector('#export-data')?.addEventListener('click', exportData);
    document.querySelector('#export-report')?.addEventListener('click', exportReport);
    document.querySelector('#import-data')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importData(file); event.target.value = ''; });
    document.querySelector('#delete-data')?.addEventListener('click', () => document.querySelector('#confirm-dialog').showModal());
    document.querySelector('#confirm-delete')?.addEventListener('click', event => {
      event.preventDefault(); localStorage.removeItem(STORAGE_KEY); state = structuredClone(defaultState); document.querySelector('#confirm-dialog').close(); renderAll(); showToast('Todos los datos se han borrado');
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
