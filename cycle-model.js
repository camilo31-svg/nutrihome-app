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
  const gaussian = (value, center, deviation) => Math.exp(-0.5 * ((value - center) / deviation) ** 2);
  const logistic = value => 1 / (1 + Math.exp(-value));

  function weightedQuantile(days, probabilities, quantile) {
    let cumulative = 0;
    for (let index = 0; index < days.length; index += 1) {
      cumulative += probabilities[index];
      if (cumulative >= quantile) return days[index];
    }
    return days.at(-1);
  }

  function weightedValueQuantile(samples, quantile) {
    const sorted = samples
      .filter(sample => Number.isFinite(sample.value) && Number.isFinite(sample.weight) && sample.weight >= 0)
      .sort((a, b) => a.value - b.value);
    const total = sorted.reduce((sum, sample) => sum + sample.weight, 0);
    if (!sorted.length || total <= 0) return 0;
    const target = clamp(quantile, 0, 1) * total;
    let cumulative = 0;
    for (const sample of sorted) {
      cumulative += sample.weight;
      if (cumulative >= target) return sample.value;
    }
    return sorted.at(-1).value;
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

  function normalizedPosterior(posterior, cycleLength, periodLength) {
    const days = Array.isArray(posterior?.days) ? posterior.days : [];
    const probabilities = Array.isArray(posterior?.probabilities) ? posterior.probabilities : [];
    const candidates = days
      .map((day, index) => ({ day: Number(day), probability: Number(probabilities[index]) }))
      .filter(candidate => Number.isFinite(candidate.day)
        && candidate.day >= 1
        && candidate.day <= cycleLength
        && Number.isFinite(candidate.probability)
        && candidate.probability >= 0);
    const total = candidates.reduce((sum, candidate) => sum + candidate.probability, 0);
    if (candidates.length && total > 0) {
      return {
        days: candidates.map(candidate => candidate.day),
        probabilities: candidates.map(candidate => candidate.probability / total),
        confidence: finite(posterior?.confidence) ? clamp(Number(posterior.confidence), 0, 100) : null
      };
    }
    return inferOvulation({ cycleLength, periodLength, configured: false, historyCount: 0, logs: [] });
  }

  // These are dimensionless reference shapes, not serum or urine concentrations.
  // Ovulation is day zero: E2 peaks just before it, LH is brief, and luteal P4 peaks later.
  function hormoneShape(cycleDay, ovulationDay) {
    const relativeDay = cycleDay - ovulationDay;
    const estradiol = 12
      + 80 * gaussian(relativeDay, -1.25, 2.45)
      + 42 * gaussian(relativeDay, 6.5, 3.15);
    const progesterone = 4
      + 91 * gaussian(relativeDay, 7, 3.15) * logistic((relativeDay - 0.6) / 0.75);
    const lh = 4 + 96 * gaussian(relativeDay, -0.35, 0.78);
    const fsh = 10
      + 45 * gaussian(cycleDay, 2, 2.1)
      + 27 * gaussian(relativeDay, -0.35, 1.45);
    return {
      estradiol: clamp(estradiol, 0, 100),
      progesterone: clamp(progesterone, 0, 100),
      lh: clamp(lh, 0, 100),
      fsh: clamp(fsh, 0, 100)
    };
  }

  /**
   * Mixes reference hormone shapes over the full ovulation-day posterior.
   * Values are relative indices from 0 to 100 and must never be read as lab results.
   */
  function expectedHormones(options = {}) {
    const cycleLength = clamp(Math.round(Number(options.cycleLength) || 29), 15, 90);
    const periodLength = clamp(Math.round(Number(options.periodLength) || 5), 1, Math.min(14, cycleLength));
    const cycleDay = clamp(Math.round(Number(options.cycleDay) || 1), 1, cycleLength);
    const posterior = normalizedPosterior(options.posterior, cycleLength, periodLength);
    const result = { estradiol: 0, progesterone: 0, lh: 0, fsh: 0 };
    const samples = { estradiol: [], progesterone: [], lh: [], fsh: [] };
    let meanOvulationDay = 0;
    posterior.days.forEach((ovulationDay, index) => {
      const probability = posterior.probabilities[index];
      const shape = hormoneShape(cycleDay, ovulationDay);
      meanOvulationDay += ovulationDay * probability;
      Object.keys(result).forEach(hormone => {
        result[hormone] += shape[hormone] * probability;
        samples[hormone].push({ value: shape[hormone], weight: probability });
      });
    });
    Object.keys(result).forEach(hormone => {
      result[hormone] = Number(clamp(result[hormone], 0, 100).toFixed(1));
      const low = weightedValueQuantile(samples[hormone], 0.1);
      const high = weightedValueQuantile(samples[hormone], 0.9);
      // A discrete posterior may put both quantiles on one mass point; retain
      // the quantiles while ensuring that the reported expectation is included.
      result[`${hormone}Low`] = Number(clamp(Math.min(low, result[hormone]), 0, 100).toFixed(1));
      result[`${hormone}High`] = Number(clamp(Math.max(high, result[hormone]), 0, 100).toFixed(1));
    });
    return {
      ...result,
      cycleDay,
      posteriorMeanOvulationDay: Number(meanOvulationDay.toFixed(2)),
      scale: 'relative-0-100',
      model: 'posterior-weighted-hormone-shapes-v1',
      isLabMeasurement: false
    };
  }

  const HORMONAL_STAGES = Object.freeze({
    menstrual: {
      label: 'Menstruación',
      summary: 'Estradiol y progesterona suelen estar relativamente bajos; la FSH puede empezar a repuntar.',
      dominantHormones: ['FSH']
    },
    earlyFollicular: {
      label: 'Folicular temprana',
      summary: 'La progesterona permanece baja y el estradiol suele comenzar un ascenso gradual.',
      dominantHormones: ['FSH', 'estradiol']
    },
    lateFollicular: {
      label: 'Folicular tardía',
      summary: 'El estradiol suele ascender hacia su pico preovulatorio mientras la progesterona sigue baja.',
      dominantHormones: ['estradiol']
    },
    ovulatory: {
      label: 'Periovulatoria',
      summary: 'Se estima un estradiol alto y un pico breve de LH alrededor de la ovulación.',
      dominantHormones: ['LH', 'estradiol']
    },
    earlyLuteal: {
      label: 'Lútea temprana',
      summary: 'La progesterona suele subir después de la ovulación y el estradiol baja desde su primer pico.',
      dominantHormones: ['progesterona']
    },
    midLuteal: {
      label: 'Lútea media',
      summary: 'La progesterona suele estar relativamente alta y el estradiol presenta un segundo aumento menor.',
      dominantHormones: ['progesterona', 'estradiol']
    },
    lateLuteal: {
      label: 'Lútea tardía',
      summary: 'Si no hay embarazo, progesterona y estradiol suelen descender antes de la siguiente menstruación.',
      dominantHormones: ['progesterona', 'estradiol']
    }
  });

  function hormonalStage(options = {}) {
    const cycleLength = clamp(Math.round(Number(options.cycleLength) || 29), 15, 90);
    const periodLength = clamp(Math.round(Number(options.periodLength) || 5), 1, Math.min(14, cycleLength));
    const cycleDay = clamp(Math.round(Number(options.cycleDay) || 1), 1, cycleLength);
    const posterior = normalizedPosterior(options.posterior, cycleLength, periodLength);
    const hormones = expectedHormones({ posterior, cycleDay, cycleLength, periodLength });
    let key = 'menstrual';
    let probability = 1;

    if (cycleDay > periodLength) {
      const stageProbabilities = {
        earlyFollicular: 0,
        lateFollicular: 0,
        ovulatory: 0,
        earlyLuteal: 0,
        midLuteal: 0,
        lateLuteal: 0
      };
      posterior.days.forEach((ovulationDay, index) => {
        const relativeDay = cycleDay - ovulationDay;
        const stageKey = relativeDay <= -6 ? 'earlyFollicular'
          : relativeDay <= -2 ? 'lateFollicular'
            : relativeDay <= 1 ? 'ovulatory'
              : relativeDay <= 4 ? 'earlyLuteal'
                : relativeDay <= 9 ? 'midLuteal'
                  : 'lateLuteal';
        stageProbabilities[stageKey] += posterior.probabilities[index];
      });
      [key, probability] = Object.entries(stageProbabilities)
        .reduce((best, entry) => entry[1] > best[1] ? entry : best, ['earlyFollicular', 0]);
    }

    const definition = HORMONAL_STAGES[key];
    return {
      key,
      label: definition.label,
      summary: definition.summary,
      dominantHormones: [...definition.dominantHormones],
      probability: Number(clamp(probability, 0, 1).toFixed(3)),
      confidence: posterior.confidence,
      hormones,
      disclaimer: 'Estimación relativa basada en el ciclo y las señales registradas; no mide hormonas ni sustituye una analítica.'
    };
  }

  function hormoneSeries(options = {}) {
    const cycleLength = clamp(Math.round(Number(options.cycleLength) || 29), 15, 90);
    const periodLength = clamp(Math.round(Number(options.periodLength) || 5), 1, Math.min(14, cycleLength));
    const posterior = normalizedPosterior(options.posterior, cycleLength, periodLength);
    return Array.from({ length: cycleLength }, (_, index) => {
      const cycleDay = index + 1;
      const hormones = expectedHormones({ posterior, cycleDay, cycleLength, periodLength });
      const stage = hormonalStage({ posterior, cycleDay, cycleLength, periodLength });
      return {
        day: cycleDay,
        estradiol: hormones.estradiol,
        estradiolLow: hormones.estradiolLow,
        estradiolHigh: hormones.estradiolHigh,
        progesterone: hormones.progesterone,
        progesteroneLow: hormones.progesteroneLow,
        progesteroneHigh: hormones.progesteroneHigh,
        lh: hormones.lh,
        lhLow: hormones.lhLow,
        lhHigh: hormones.lhHigh,
        fsh: hormones.fsh,
        fshLow: hormones.fshLow,
        fshHigh: hormones.fshHigh,
        stage: stage.key,
        stageLabel: stage.label
      };
    });
  }

  root.MareaCycleModel = Object.freeze({
    inferOvulation,
    phaseProbabilities,
    expectedHormones,
    hormonalStage,
    hormoneSeries
  });
})(typeof window === 'undefined' ? globalThis : window);
