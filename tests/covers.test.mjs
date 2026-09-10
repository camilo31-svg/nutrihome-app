import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const fit = app.match(/function fitFallbackCover\(node\) \{[\s\S]*?\n\}/)[0];
// Every viewport remains inside its selected cell, with the white gutters excluded.
for (const [width, height] of [[78,78],[225,225],[358,230],[300,428],[680,230]]) {
  for (let cell = 0; cell < 16; cell++) {
    const node = { classList: { contains: () => false }, dataset: { photoRecipe: 'test' }, style: {}, getBoundingClientRect: () => ({width,height}) };
    const context = { node, findRecipe: () => ({}), coverPosition: () => ({ x: `${cell % 4 * 33.333}%`, y: `${Math.floor(cell / 4) * 33.333}%` }) };
    vm.runInNewContext(`${fit}; fitFallbackCover(node);`, context);
    const size = parseFloat(node.style.backgroundSize) / 4;
    const [x,y] = node.style.backgroundPosition.split(' ').map(parseFloat);
    assert.ok(-x > (cell % 4 + .02) * size);
    assert.ok(-x + width < (cell % 4 + .98) * size);
    assert.ok(-y > (Math.floor(cell / 4) + .02) * size);
    assert.ok(-y + height < (Math.floor(cell / 4) + .98) * size);
  }
}
for (const source of [app, await readFile(new URL('../worker/index.js', import.meta.url), 'utf8')]) {
  const literal = source.match(/const rejectedTitles = (\/.*?\/i);/)[1];
  const rejected = vm.runInNewContext(literal);
  for (const title of ['Food collage.jpg','Salad montage.png','Recipe grid.jpg','Food atlas.png']) assert.ok(rejected.test(title));
  assert.equal(rejected.test('Chickpea curry.jpg'), false);
}
console.log('Recipe cover crops and collage filters passed');
