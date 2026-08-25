(function initMareaCycleModel(root) {
  'use strict';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const median = values => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const gaussianScore = (day, center, deviation, strength = 1) => -0.5 * ((day - center) / deviation) ** 2 * strength;

  function weightedQuantile(days, probabilities, quantile) {
    let cumulative = 0;
    for (let index = 0; index < days.length; index += 1) {
      cumulative += probabilities[index];
      if (cumulative >= quantile) return days[index];
    }
    return days.at(-1);
  }

  function sustainedShift(logs, valueKey, threshold, direction = 1, qualityFilter = () => true) {
    const samples = logs
      .filter(log => finite(log[valueKey]) && qualityFilter(log))
      .map(log => ({ day: log.day, value: Number(log[valueKey]) }))
      .sort((a, b) => a.day - b.day);
    const byDay = new Map(samples.map(sample => [sample.day, sample.value]));
    for (const sample of samples) {
      const day = sample.day;
      const sequence = [byDay.get(day), byDay.get(day + 1), byDay.get(day + 2)];
      if (!sequence.every(finite)) continue;
      const baseline = samples.filter(item => item.day >= day - 8 && item.day < day).map(item => item.value).slice(-6);
      if (baseline.length < 4) continue;
      const change = (mean(sequence) - median(baseline)) * direction;
      if (change >= threshold) return { day, change, baseline: median(baseline) };
    }
    return null;
  }

  function inferOvulation(options = {}) {
    const cycleLength = clamp(Math.round(Number(options.cycleLength) || 29), 15, 90);
    const periodLength = clamp(Math.round(Number(options.periodLength) || 5), 1, 14);
    const variability = clamp(Number(options.variability) || 2.8, 1, 14);
    const historyCount = clamp(Number(options.historyCount) || 0, 0, 30);
    const configured = options.configured !== false;
    const minDay = Math.min(cycleLength - 5, Math.max(periodLength + 1, 7));
    const maxDay = Math.max(minDay, cycleLength - 5);
    const days = Array.from({ length: maxDay - minDay + 1 }, (_, index) => minDay + index);
    const priorCenter = clamp(cycleLength - 14, minDay, maxDay);
    const priorSd = clamp(2.4 + variability * 0.72 + (historyCount < 3 ? (3 - historyCount) * 0.45 : 0), 2.6, 10);
    const scores = days.map(day => gaussianScore(day, priorCenter, priorSd));
    const logs = (Array.isArray(options.logs) ? options.logs : [])
      .filter(log => log && Number.isFinite(Number(log.day)) && log.day >= 1 && log.day <= cycleLength)
      .map(log => ({ ...log, day: Number(log.day) }))
      .sort((a, b) => a.day - b.day);
    const evidence = [];

    function addGaussian(center, deviation, strength, type, label, detail) {
      days.forEach((day, index) => { scores[index] += gaussianScore(day, center, deviation, strength); });
      evidence.push({ type, label, detail, center: clamp(Math.round(center), minDay, maxDay) });
    }

    const peakLh = logs.find(log => log.lhTest === 'peak');
    const positiveLh = logs.find(log => log.lhTest === 'positive');
    if (peakLh) addGaussian(peakLh.day + 1, 0.9, 2.8, 'lh', 'Pico de LH', `día ${peakLh.day}`);
    else if (positiveLh) addGaussian(positiveLh.day + 1.3, 1.25, 2.1, 'lh', 'LH positivo', `día ${positiveLh.day}`);

    logs.filter(log => log.lhTest === 'negative').slice(-6).forEach(log => {
      days.forEach((day, index) => {
        const proximity = Math.exp(-0.5 * ((day - (log.day + 1)) / 1.2) ** 2);
        scores[index] -= proximity * 0.34;
      });
    });

    const positivePdg = logs.find(log => log.pdgTest === 'positive');
    if (positivePdg) addGaussian(positivePdg.day - 3, 2.2, 1.6, 'pdg', 'PdG positivo', `día ${positivePdg.day}`);

    const temperatureShift = sustainedShift(
      logs,
      'temperature',
      0.2,
      1,
      log => !(log.temperatureFactors || []).length
    );
    if (temperatureShift) addGaussian(temperatureShift.day - 1, 1.45, 1.9, 'bbt', 'Cambio térmico basal', `+${temperatureShift.change.toFixed(2)} °C`);

    const wristShift = sustainedShift(logs, 'wristTemperatureDelta', 0.15, 1);
    if (wristShift) addGaussian(wristShift.day - 1, 1.8, 1.25, 'wrist', 'Temperatura nocturna', `+${wristShift.change.toFixed(2)} °C`);

    const mucusPeak = [...logs].reverse().find(log => log.cervical === 'eggwhite' || log.cervicalSensation === 'slippery') || [...logs].reverse().find(log => log.cervical === 'watery' || log.cervicalSensation === 'wet');
    if (mucusPeak) {
      const peakQuality = mucusPeak.cervical === 'eggwhite' || mucusPeak.cervicalSensation === 'slippery';
      addGaussian(mucusPeak.day + (peakQuality ? 0.4 : 1), 2.1, peakQuality ? 0.95 : 0.65, 'mucus', 'Moco cervical fértil', `día ${mucusPeak.day}`);
    }

    const heartRateShift = sustainedShift(logs, 'restingHeartRate', 2, 1);
    if (heartRateShift) addGaussian(heartRateShift.day - 1, 2.8, 0.38, 'vitals', 'Pulso en reposo', `cambio sostenido`);
    const hrvShift = sustainedShift(logs, 'hrv', 5, -1);
    if (hrvShift) addGaussian(hrvShift.day - 1, 3, 0.28, 'vitals', 'Variabilidad cardiaca', `cambio sostenido`);

    const maximumScore = Math.max(...scores);
    const weights = scores.map(score => Math.exp(score - maximumScore));
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const probabilities = weights.map(weight => weight / total);
    const modeIndex = probabilities.indexOf(Math.max(...probabilities));
    const modeDay = days[modeIndex];
    const meanDay = days.reduce((sum, day, index) => sum + day * probabilities[index], 0);
    const lowDay = weightedQuantile(days, probabilities, 0.1);
    const highDay = weightedQuantile(days, probabilities, 0.9);
    const uniqueTypes = [...new Set(evidence.map(item => item.type))];
    const directTypes = uniqueTypes.filter(type => ['lh', 'pdg', 'bbt', 'wrist'].includes(type));
    const sourceBonus = { lh: 25, pdg: 17, bbt: 17, wrist: 11, mucus: 8, vitals: 4 };
    const evidenceBonus = uniqueTypes.reduce((sum, type) => sum + (sourceBonus[type] || 0), 0);
    const priorConfidence = 32 + Math.min(historyCount, 6) * 5 - variability * 1.8 + (configured ? 4 : -7);
    const widthPenalty = Math.max(0, highDay - lowDay - 3) * 1.45;
    let confidence = clamp(Math.round(priorConfidence + evidenceBonus - widthPenalty), 20, 92);
    if (!directTypes.length) confidence = Math.min(confidence, 68);

    return {
      days,
      probabilities,
      modeDay,
      meanDay,
      lowDay,
      highDay,
      confidence,
      priorCenter,
      priorSd,
      evidence,
      signalTypes: uniqueTypes,
      directSignalTypes: directTypes,
      confirmedBySignals: directTypes.length > 0,
      temperatureShiftDay: temperatureShift?.day || null,
      model: 'bayesian-multisignal-v2'
    };
  }

  function phaseProbabilities(posterior, cycleDay, periodLength) {
    if (cycleDay <= periodLength) return { menstrual: 1, follicular: 0, fertile: 0, ovulation: 0, luteal: 0 };
    let ovulation = 0;
    let fertile = 0;
    let luteal = 0;
    posterior.days.forEach((ovulationDay, index) => {
      const probability = posterior.probabilities[index];
      if (ovulationDay === cycleDay) ovulation += probability;
      if (ovulationDay >= cycleDay && ovulationDay <= cycleDay + 5) fertile += probability;
      if (ovulationDay < cycleDay) luteal += probability;
    });
    const follicular = clamp(1 - fertile - luteal, 0, 1);
    return { menstrual: 0, follicular, fertile, ovulation, luteal };
  }

  root.MareaCycleModel = Object.freeze({ inferOvulation, phaseProbabilities });
})(typeof window === 'undefined' ? globalThis : window);
