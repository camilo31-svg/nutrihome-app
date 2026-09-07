import assert from 'node:assert/strict';
import { DEMO_RECIPES, DEFAULT_PROFILE, createDemoPantry } from '../demo-data.js';
import { DIET_CATALOG_PROFILES, RECIPE_LIBRARY, catalogCounts } from '../recipe-library.js';
import { createStateSnapshot } from '../storage.js';
import { estimateRecipe, inferRecipeTraits, parseFlexibleIngredients } from '../recipe-estimator.js';
import {
  buildShoppingList, calculateBMI, calculateGoalProgress, classifyAdultBMI, consumeRecipe, convertQuantity, generateWeek, getExpiryStatus,
  ingredientMatchesExclusion, isRecipeCompatible, normalizeText, pantryCoverage, rankMealCandidates, regenerateMeal, sameFood, scaleIngredients, upsertBodyMeasurement, upsertPantryItem, validateRecipe
} from '../nutrihome-core.js';

const GENERIC_RECIPE_STEPS = [
  'Prepara y mide todos los ingredientes.',
  'Cocina siguiendo el orden indicado hasta que todo esté en su punto.',
  'Ajusta el aliño, sirve y disfruta.'
];

assert.equal(DEMO_RECIPES.length, 25);
for (const recipe of DEMO_RECIPES) {
  assert.ok(recipe.steps.length >= 4, `${recipe.name} debe tener al menos cuatro pasos específicos`);
  assert.equal(recipe.steps.some(step => GENERIC_RECIPE_STEPS.includes(step)), false, `${recipe.name} conserva instrucciones genéricas`);
}
assert.equal(new Set(DEMO_RECIPES.map(recipe => recipe.steps.join('\n'))).size, DEMO_RECIPES.length, 'Cada receta debe tener instrucciones propias');

assert.equal(RECIPE_LIBRARY.length > 1600, true, 'El catálogo debe contener más de 1.600 recetas únicas');
assert.equal(new Set(RECIPE_LIBRARY.map(recipe => recipe.id)).size, RECIPE_LIBRARY.length, 'Los IDs del catálogo deben ser únicos');
assert.equal(new Set(RECIPE_LIBRARY.map(recipe => recipe.name)).size, RECIPE_LIBRARY.length, 'Los nombres del catálogo deben ser únicos');
const dietCounts = catalogCounts(isRecipeCompatible);
for (const profile of DIET_CATALOG_PROFILES) assert.ok(dietCounts[profile.key] > 1000, `${profile.label} debe ofrecer más de 1.000 recetas`);
for (const recipe of RECIPE_LIBRARY) {
  assert.deepEqual(validateRecipe(recipe), [], `${recipe.name} debe tener ingredientes y cantidades válidos`);
  assert.ok(recipe.steps.length >= 4, `${recipe.name} debe tener al menos cuatro pasos`);
  assert.equal(recipe.steps.some(step => GENERIC_RECIPE_STEPS.includes(step)), false, `${recipe.name} no puede usar instrucciones genéricas`);
  const stepText = normalizeText(recipe.steps.join(' '));
  const mentionedIngredients = recipe.ingredients.filter(item => normalizeText(item.name).split(' ').filter(word => word.length >= 4).some(word => stepText.includes(word))).length;
  assert.ok(mentionedIngredients >= 2, `${recipe.name} debe mencionar sus ingredientes concretos en los pasos`);
}
const compactSnapshot = createStateSnapshot({ version: 1, recipes: [...RECIPE_LIBRARY, { id: 'rec-user-test', source: 'Receta personal' }], favorites: [] });
assert.deepEqual(compactSnapshot.recipes.map(recipe => recipe.id), ['rec-user-test'], 'La copia guarda recetas personales, no duplica el catálogo incorporado');
assert.ok(JSON.stringify(compactSnapshot).length < 1_500_000, 'La copia sincronizable debe respetar el límite del servidor');
const expandedMenu = generateWeek({ recipes: RECIPE_LIBRARY, profile: { ...DEFAULT_PROFILE, diet: 'vegan', eatsEgg: false, eatsDairy: false }, pantry: createDemoPantry(), exercise: [] });
assert.equal(expandedMenu.length, 28, 'El generador semanal debe funcionar con el catálogo completo');
assert.equal(expandedMenu.every(entry => isRecipeCompatible(RECIPE_LIBRARY.find(recipe => recipe.id === entry.recipeId), { ...DEFAULT_PROFILE, diet: 'vegan', eatsEgg: false, eatsDairy: false })), true);

assert.equal(convertQuantity(1, 'kg', 'g'), 1000);
assert.equal(convertQuantity(1.5, 'l', 'ml'), 1500);
assert.equal(convertQuantity(250, 'g', 'kg'), 0.25);
assert.equal(convertQuantity(500, 'ml', 'l'), 0.5);
assert.throws(() => convertQuantity(1, 'l', 'g'), /familias/);
assert.equal(sameFood('garbanzos cocidos', 'garbanzo cocido'), true);
assert.equal(sameFood('garbanzos cocidos', 'garbanzos secos'), false);
assert.equal(sameFood('tomates cherry', 'tomate'), true);
assert.equal(calculateBMI(70, 175), 22.9);
assert.deepEqual(classifyAdultBMI(18.4), { key: 'below', label: 'Bajo peso' });
assert.deepEqual(classifyAdultBMI(24.9), { key: 'reference', label: 'Peso saludable' });
assert.deepEqual(classifyAdultBMI(25), { key: 'above', label: 'Sobrepeso' });
assert.deepEqual(classifyAdultBMI(30), { key: 'high', label: 'Obesidad' });
assert.deepEqual(calculateGoalProgress(80, 75, 70), { percent: 50, remaining: 5, reached: false });
assert.deepEqual(calculateGoalProgress(30, 33, 32), { percent: 100, remaining: 0, reached: true });
const bodyHistory = upsertBodyMeasurement([], { date: '2026-09-05', weightKg: 72.4, muscleKg: 31.2 });
assert.deepEqual(upsertBodyMeasurement(bodyHistory, { date: '2026-09-05', weightKg: 72.1, muscleKg: 31.4 })[0], { id: 'body-2026-09-05', date: '2026-09-05', weightKg: 72.1, muscleKg: 31.4 });
assert.throws(() => upsertBodyMeasurement([], { date: '2026-09-05', weightKg: 70, muscleKg: 75 }), /masa muscular/);

const eggRecipe = DEMO_RECIPES.find(recipe => recipe.id === 'rec-tortilla-patata');
const dairyRecipe = DEMO_RECIPES.find(recipe => recipe.id === 'rec-yogur-nueces');
const fishRecipe = DEMO_RECIPES.find(recipe => recipe.id === 'rec-salmon-boniato');
const veganRecipe = DEMO_RECIPES.find(recipe => recipe.id === 'rec-bowl-garbanzos');
const vegetarianNoEgg = { ...DEFAULT_PROFILE, diet: 'vegetarian', eatsEgg: false, eatsDairy: true };
assert.equal(isRecipeCompatible(eggRecipe, vegetarianNoEgg), false);
assert.equal(isRecipeCompatible(dairyRecipe, vegetarianNoEgg), true);
assert.equal(isRecipeCompatible(dairyRecipe, { ...vegetarianNoEgg, eatsDairy: false }), false);
assert.equal(isRecipeCompatible(fishRecipe, vegetarianNoEgg), false);
assert.equal(isRecipeCompatible(veganRecipe, vegetarianNoEgg), true);
assert.equal(isRecipeCompatible(dairyRecipe, { ...DEFAULT_PROFILE, diet: 'vegan' }), false);
assert.equal(isRecipeCompatible(veganRecipe, { ...DEFAULT_PROFILE, allergies: ['garbanzo'] }), false);
assert.equal(ingredientMatchesExclusion('pimiento rojo asado', 'pimiento'), true);
assert.equal(ingredientMatchesExclusion('salsa de tomate', 'sal'), false);
assert.equal(isRecipeCompatible(fishRecipe, { ...DEFAULT_PROFILE, dislikes: ['pescado'] }), false, 'Una exclusión amplia bloquea ingredientes de su familia');
assert.equal(isRecipeCompatible(DEMO_RECIPES.find(recipe => recipe.ingredients.some(item => normalizeText(item.name).includes('pimiento rojo'))), { ...DEFAULT_PROFILE, dislikes: ['pimiento'] }), false, 'Excluir un ingrediente bloquea también sus variantes descriptivas');

const scaled = scaleIngredients(veganRecipe, 4);
assert.equal(scaled.find(item => item.name === 'garbanzos cocidos').amount, 640);
assert.deepEqual(veganRecipe.ingredients.find(item => item.name === 'garbanzos cocidos').amount, 320);

const pantry = [{ id: 'rice', name: 'arroz', quantity: 300, unit: 'g', minQuantity: 0 }];
const menuRecipe = { id: 'recipe-rice', servings: 1, ingredients: [{ name: 'arroz', amount: 700, unit: 'g', category: 'cereales' }] };
const shopping = buildShoppingList([{ id: 'meal', day: 0, mealType: 'lunch', recipeId: 'recipe-rice', servings: 1 }], [menuRecipe], pantry);
assert.equal(shopping.length, 1);
assert.equal(shopping[0].quantity, 400);
assert.equal(shopping[0].available, 300);
assert.equal(buildShoppingList([{ recipeId: 'recipe-rice', servings: 1 }], [menuRecipe], [{ ...pantry[0], quantity: 900 }]).length, 0);

const consumed = consumeRecipe(menuRecipe, 1, [{ ...pantry[0], quantity: 900 }]);
assert.equal(consumed.pantry[0].quantity, 200);
assert.equal(consumed.shortages.length, 0);
const shortage = consumeRecipe(menuRecipe, 1, pantry);
assert.equal(shortage.pantry.length, 0);
assert.deepEqual(shortage.shortages, [{ name: 'arroz', amount: 400, unit: 'g' }]);

const merged = upsertPantryItem(pantry, { name: 'arroz', quantity: 0.5, unit: 'kg' });
assert.equal(merged.length, 2, 'No mezcla lotes con unidades distintas sin convertir silenciosamente');

const demoPantry = createDemoPantry();
assert.equal(pantryCoverage(veganRecipe, demoPantry, 2).covered > 0, true);
const menu = generateWeek({ recipes: DEMO_RECIPES, profile: vegetarianNoEgg, pantry: demoPantry, exercise: [] });
assert.equal(menu.length, 28);
assert.equal(menu.every(entry => isRecipeCompatible(DEMO_RECIPES.find(recipe => recipe.id === entry.recipeId), vegetarianNoEgg)), true);
const locked = { ...menu[0], locked: true };
const regenerated = generateWeek({ recipes: DEMO_RECIPES, profile: vegetarianNoEgg, pantry: demoPantry, previousMenu: [locked], mode: 'surprise' });
assert.deepEqual(regenerated.find(entry => entry.id === locked.id), locked);
const noChange = regenerateMeal({ entry: locked, menu, recipes: DEMO_RECIPES, profile: vegetarianNoEgg, pantry: demoPantry });
assert.equal(noChange, menu);
const candidates = rankMealCandidates({ entry: menu[0], menu, recipes: RECIPE_LIBRARY, profile: vegetarianNoEgg, pantry: demoPantry, limit: 100 });
assert.equal(candidates.length, 100, 'El selector ofrece cien alternativas cuando el catálogo lo permite');
assert.equal(candidates.every(recipe => recipe.mealTypes.includes(menu[0].mealType) && isRecipeCompatible(recipe, vegetarianNoEgg)), true);

const flexible = parseFlexibleIngredients('arroz integral\ntomate\n2 huevos\n1 cucharada de aceite de oliva', 2);
assert.equal(flexible.length, 4);
assert.equal(flexible[0].inferred, true, 'Se infiere una cantidad cuando no se proporciona');
assert.equal(flexible[2].unit, 'unidad');
assert.equal(flexible[2].amount, 2);
assert.equal(flexible[3].unit, 'g');
const autoEstimate = estimateRecipe(flexible, 2);
assert.ok(autoEstimate.estimatedCost > 0);
assert.ok(autoEstimate.nutrition.kcal > 0 && autoEstimate.nutrition.protein > 0 && autoEstimate.nutrition.fiber > 0);
assert.ok(inferRecipeTraits(flexible).includes('egg'));

const today = new Date();
const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).toISOString().slice(0, 10);
assert.equal(getExpiryStatus(todayKey, today).key, 'today');

console.log('NutriHome core tests passed');
