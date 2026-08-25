import assert from 'node:assert/strict';
import '../cycle-model.js';

const model = globalThis.MareaCycleModel;

const priorOnly = model.inferOvulation({ cycleLength: 29, periodLength: 5, variability: 2.5, historyCount: 0, configured: false, logs: [] });
assert.equal(priorOnly.model, 'bayesian-multisignal-v2');
assert.ok(Math.abs(priorOnly.probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
assert.ok(priorOnly.confidence <= 68);

const withLh = model.inferOvulation({ cycleLength: 29, periodLength: 5, variability: 2.5, historyCount: 3, logs: [{ day: 16, lhTest: 'peak' }] });
assert.ok(withLh.modeDay >= 16 && withLh.modeDay <= 18);
assert.ok(withLh.signalTypes.includes('lh'));
assert.ok(withLh.confidence > priorOnly.confidence);

const temperatures = [36.30, 36.28, 36.31, 36.27, 36.29, 36.30, 36.55, 36.58, 36.57].map((temperature, index) => ({ day: index + 8, temperature, temperatureFactors: [] }));
const withTemperature = model.inferOvulation({ cycleLength: 29, periodLength: 5, variability: 2.5, historyCount: 3, logs: temperatures });
assert.ok(withTemperature.signalTypes.includes('bbt'));
assert.ok(withTemperature.modeDay >= 12 && withTemperature.modeDay <= 15);

const alteredTemperatures = temperatures.map(log => ({ ...log, temperatureFactors: ['illness'] }));
const excludedTemperature = model.inferOvulation({ cycleLength: 29, periodLength: 5, variability: 2.5, historyCount: 3, logs: alteredTemperatures });
assert.ok(!excludedTemperature.signalTypes.includes('bbt'));

const phases = model.phaseProbabilities(withLh, 13, 5);
assert.ok(phases.fertile > 0);

const pointPosterior = { days: [15], probabilities: [1], confidence: 84 };
const series = model.hormoneSeries({ posterior: pointPosterior, cycleLength: 29, periodLength: 5 });
assert.equal(series.length, 29);
assert.deepEqual(series.map(point => point.day), Array.from({ length: 29 }, (_, index) => index + 1));
for (const point of series) {
  for (const hormone of ['estradiol', 'progesterone', 'lh', 'fsh']) {
    assert.ok(Number.isFinite(point[hormone]), `${hormone} must be finite on day ${point.day}`);
    assert.ok(point[hormone] >= 0 && point[hormone] <= 100, `${hormone} must stay on its relative 0-100 scale`);
    assert.ok(Number.isFinite(point[`${hormone}Low`]) && Number.isFinite(point[`${hormone}High`]), `${hormone} bounds must be finite`);
    assert.ok(point[`${hormone}Low`] >= 0 && point[`${hormone}High`] <= 100, `${hormone} bounds must stay on the 0-100 scale`);
    assert.ok(point[`${hormone}Low`] <= point[hormone] + 0.11, `${hormone} lower bound must contain the expectation`);
    assert.ok(point[`${hormone}High`] + 0.11 >= point[hormone], `${hormone} upper bound must contain the expectation`);
    assert.equal(point[`${hormone}Low`], point[hormone], `${hormone} point-posterior lower bound must collapse`);
    assert.equal(point[`${hormone}High`], point[hormone], `${hormone} point-posterior upper bound must collapse`);
  }
}

const atOvulation = model.expectedHormones({ posterior: pointPosterior, cycleDay: 15, cycleLength: 29, periodLength: 5 });
const farFromOvulation = model.expectedHormones({ posterior: pointPosterior, cycleDay: 8, cycleLength: 29, periodLength: 5 });
assert.ok(atOvulation.lh > farFromOvulation.lh * 3, 'LH should form a narrow periovulatory surge');
const estradiolPeak = model.expectedHormones({ posterior: pointPosterior, cycleDay: 14, cycleLength: 29, periodLength: 5 });
const earlyEstradiol = model.expectedHormones({ posterior: pointPosterior, cycleDay: 7, cycleLength: 29, periodLength: 5 });
assert.ok(estradiolPeak.estradiol > earlyEstradiol.estradiol, 'Estradiol should peak before ovulation');
const midLuteal = model.expectedHormones({ posterior: pointPosterior, cycleDay: 22, cycleLength: 29, periodLength: 5 });
assert.ok(midLuteal.progesterone > atOvulation.progesterone * 4, 'Progesterone should peak in the mid-luteal interval');
const lateLuteal = model.expectedHormones({ posterior: pointPosterior, cycleDay: 28, cycleLength: 29, periodLength: 5 });
assert.ok(midLuteal.estradiol > lateLuteal.estradiol, 'The secondary estradiol rise should recede late in the luteal interval');
assert.ok(midLuteal.progesterone > lateLuteal.progesterone, 'Progesterone should recede late in the luteal interval');
const earlyFsh = model.expectedHormones({ posterior: pointPosterior, cycleDay: 2, cycleLength: 29, periodLength: 5 });
const midFollicularFsh = model.expectedHormones({ posterior: pointPosterior, cycleDay: 8, cycleLength: 29, periodLength: 5 });
assert.ok(earlyFsh.fsh > midFollicularFsh.fsh, 'FSH should have an early-follicular rise');

const posteriorA = { days: [14], probabilities: [1] };
const posteriorB = { days: [18], probabilities: [1] };
const posteriorMixture = { days: [14, 18], probabilities: [2, 2] };
const hormonesA = model.expectedHormones({ posterior: posteriorA, cycleDay: 14, cycleLength: 30, periodLength: 5 });
const hormonesB = model.expectedHormones({ posterior: posteriorB, cycleDay: 14, cycleLength: 30, periodLength: 5 });
const hormonesMixture = model.expectedHormones({ posterior: posteriorMixture, cycleDay: 14, cycleLength: 30, periodLength: 5 });
for (const hormone of ['estradiol', 'progesterone', 'lh', 'fsh']) {
  const expectedAverage = (hormonesA[hormone] + hormonesB[hormone]) / 2;
  assert.ok(Math.abs(hormonesMixture[hormone] - expectedAverage) <= 0.11, `${hormone} should integrate across the posterior`);
  assert.ok(hormonesMixture[`${hormone}Low`] <= hormonesMixture[hormone] + 0.11);
  assert.ok(hormonesMixture[`${hormone}High`] + 0.11 >= hormonesMixture[hormone]);
}
assert.ok(hormonesMixture.lhHigh > hormonesMixture.lhLow, 'A mixed ovulation posterior should produce a non-zero LH interval near a candidate surge');

const menstrualStage = model.hormonalStage({ posterior: pointPosterior, cycleDay: 2, cycleLength: 29, periodLength: 5 });
assert.equal(menstrualStage.key, 'menstrual');
assert.equal(menstrualStage.probability, 1);
assert.equal(menstrualStage.hormones.isLabMeasurement, false);
const ovulatoryStage = model.hormonalStage({ posterior: pointPosterior, cycleDay: 15, cycleLength: 29, periodLength: 5 });
assert.equal(ovulatoryStage.key, 'ovulatory');
const lutealStage = model.hormonalStage({ posterior: pointPosterior, cycleDay: 22, cycleLength: 29, periodLength: 5 });
assert.equal(lutealStage.key, 'midLuteal');

const malformedPosteriorHormones = model.expectedHormones({
  posterior: { days: [15, Number.NaN, 17], probabilities: [0, -1, Number.NaN] },
  cycleDay: 12,
  cycleLength: 29,
  periodLength: 5
});
for (const hormone of ['estradiol', 'progesterone', 'lh', 'fsh']) {
  assert.ok(Number.isFinite(malformedPosteriorHormones[hormone]));
  assert.ok(Number.isFinite(malformedPosteriorHormones[`${hormone}Low`]));
  assert.ok(Number.isFinite(malformedPosteriorHormones[`${hormone}High`]));
}

console.log('Marea multiseñal model tests passed');
