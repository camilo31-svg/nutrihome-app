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

console.log('Marea multiseñal model tests passed');
