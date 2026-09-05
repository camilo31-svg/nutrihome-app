import assert from 'node:assert/strict';
import { DEMO_RECIPES, DEFAULT_PROFILE, createDemoPantry } from '../demo-data.js';
import {
  buildShoppingList, calculateBMI, calculateGoalProgress, classifyAdultBMI, consumeRecipe, convertQuantity, generateWeek, getExpiryStatus,
  isRecipeCompatible, pantryCoverage, regenerateMeal, sameFood, scaleIngredients, upsertBodyMeasurement, upsertPantryItem
} from '../nutrihome-core.js';

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

const today = new Date();
const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).toISOString().slice(0, 10);
assert.equal(getExpiryStatus(todayKey, today).key, 'today');

console.log('NutriHome core tests passed');
