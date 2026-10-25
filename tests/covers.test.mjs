import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { RECIPE_LIBRARY } from '../recipe-library.js';
import { groupRecipeFamilies } from '../recipe-families.js';
import { recipePhoto, RECIPE_PHOTOS } from '../recipe-photos.js';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
assert.doesNotMatch(app, /fitFallbackCover|coverPosition|commons\.wikimedia/);
const groups = groupRecipeFamilies(RECIPE_LIBRARY);
const audit = JSON.parse(await readFile(new URL('../docs/recipe-image-audit.json', import.meta.url), 'utf8'));
assert.equal(Object.keys(RECIPE_PHOTOS).length, 74, 'Las 74 imágenes corresponden a platos base revisados');
assert.equal(groups.length, 147, 'Las recetas importadas son platos base adicionales');
const cached = { self: {} };
vm.runInNewContext(await readFile(new URL('../recipe-image-list.js', import.meta.url), 'utf8'), cached);
assert.deepEqual([...cached.self.RECIPE_IMAGE_URLS].sort(), Object.values(RECIPE_PHOTOS).map(photo => photo.src).sort());
let totalBytes = 0;
for (const group of groups.filter(group => !group.id.startsWith('wiki-'))) {
  const photo = RECIPE_PHOTOS[group.id];
  const reviewed = audit.find(entry => entry.familyId === group.id);
  assert.equal(reviewed?.recipeId, photo.recipeId, 'La imagen conserva la preparación que fue revisada');
  assert.equal(photo.recipeId, group.recipes[0].id);
  assert.deepEqual(photo.ingredients, group.recipes[0].ingredients.map(item => item.name));
  assert.ok(group.recipes.every(recipe => recipePhoto(recipe) === photo));
  const bytes = await readFile(new URL(`../${photo.src}`, import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), reviewed.sha256, 'El archivo coincide con la imagen revisada');
  assert.ok(bytes.length < 100_000, `${group.id}: imagen optimizada para móvil`);
  totalBytes += bytes.length;
}
assert.ok(totalBytes < 5_000_000, 'El catálogo de imágenes cabe en la precarga móvil');
assert.equal(recipePhoto({id: 'personal-test'}), null, 'No se inventan fotos para recetas personales');
assert.equal(recipePhoto(groups.find(group => group.id.startsWith('wiki-')).recipes[0]), null, 'No se asigna una foto ajena a una receta importada');
assert.equal(recipePhoto({...groups[0].recipes[0], hasCustomCover: true}), null);
console.log(`Recipe images verified: ${Object.keys(RECIPE_PHOTOS).length} files, ${(totalBytes/1_000_000).toFixed(2)} MB`);
