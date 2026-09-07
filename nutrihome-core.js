export const UNIT_DEFINITIONS = Object.freeze({
  mg: { family: 'weight', factor: 0.001, base: 'g' },
  g: { family: 'weight', factor: 1, base: 'g' },
  kg: { family: 'weight', factor: 1000, base: 'g' },
  ml: { family: 'volume', factor: 1, base: 'ml' },
  cl: { family: 'volume', factor: 10, base: 'ml' },
  l: { family: 'volume', factor: 1000, base: 'ml' },
  unidad: { family: 'count', factor: 1, base: 'unidad' },
  paquete: { family: 'package', factor: 1, base: 'paquete' },
  lata: { family: 'can', factor: 1, base: 'lata' },
  botella: { family: 'bottle', factor: 1, base: 'botella' }
});

const UNIT_ALIASES = Object.freeze({
  miligramo: 'mg', miligramos: 'mg', gramo: 'g', gramos: 'g', kilogramo: 'kg', kilogramos: 'kg', kilo: 'kg', kilos: 'kg',
  mililitro: 'ml', mililitros: 'ml', centilitro: 'cl', centilitros: 'cl', litro: 'l', litros: 'l',
  unidad: 'unidad', unidades: 'unidad', ud: 'unidad', uds: 'unidad', pieza: 'unidad', piezas: 'unidad',
  paquete: 'paquete', paquetes: 'paquete', lata: 'lata', latas: 'lata', botella: 'botella', botellas: 'botella'
});

const FOOD_SYNONYMS = Object.freeze({
  'garbanzo': 'garbanzo', 'garbanzos': 'garbanzo', 'garbanzos cocidos': 'garbanzo', 'garbanzo cocido': 'garbanzo',
  'tomates': 'tomate', 'tomate cherry': 'tomate', 'tomates cherry': 'tomate',
  'arroz integral': 'arroz integral', 'arroz': 'arroz', 'copos de avena': 'avena', 'avena': 'avena',
  'cebollas': 'cebolla', 'dientes de ajo': 'ajo', 'diente de ajo': 'ajo',
  'lentejas cocidas': 'lenteja', 'lenteja cocida': 'lenteja', 'lentejas': 'lenteja',
  'alubias blancas': 'alubia blanca', 'judias blancas': 'alubia blanca', 'judía blanca': 'alubia blanca',
  'pimientos rojos': 'pimiento rojo', 'pimiento': 'pimiento', 'pimientos': 'pimiento',
  'espinacas frescas': 'espinaca', 'espinacas': 'espinaca', 'hojas de espinaca': 'espinaca',
  'patatas': 'patata', 'boniatos': 'boniato', 'calabacines': 'calabacín',
  'huevos': 'huevo', 'claras de huevo': 'clara de huevo',
  'tofu firme': 'tofu', 'tofu ahumado': 'tofu', 'yogur griego': 'yogur', 'yogur natural': 'yogur',
  'bebida de soja': 'leche de soja', 'leche vegetal': 'leche vegetal'
});

const DIET_BLOCKS = Object.freeze({
  omnivore: [], flexitarian: [], pescetarian: ['meat'], vegetarian: ['meat', 'fish'],
  vegan: ['meat', 'fish', 'egg', 'dairy', 'honey'], lacto_vegetarian: ['meat', 'fish', 'egg'],
  ovo_vegetarian: ['meat', 'fish', 'dairy']
});

export const MEAL_LABELS = Object.freeze({ breakfast: 'Desayuno', lunch: 'Comida', snack: 'Merienda', dinner: 'Cena' });
export const DAY_LABELS = Object.freeze(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);

export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeUnit(unit) {
  const normalized = normalizeText(unit);
  return UNIT_DEFINITIONS[normalized] ? normalized : (UNIT_ALIASES[normalized] || normalized);
}

export function ingredientForm(name = '') {
  const value = normalizeText(name);
  if (/\b(cocid[oa]s?|en conserva|escurrid[oa]s?)\b/.test(value)) return 'cooked';
  if (/\b(sec[oa]s?|crudo|cruda)\b/.test(value)) return 'dry';
  if (/\bcongelad[oa]s?\b/.test(value)) return 'frozen';
  return '';
}

export function normalizeFoodName(name = '') {
  const value = normalizeText(name);
  if (FOOD_SYNONYMS[value]) return FOOD_SYNONYMS[value];
  return value.replace(/\b(fresco|fresca|frescos|frescas|troceado|troceada)\b/g, '').replace(/\s+/g, ' ').trim();
}

const EXCLUSION_FAMILIES = Object.freeze({
  pescado: ['pescado', 'salmon', 'atun', 'merluza', 'bacalao', 'sardina', 'trucha', 'dorada', 'lubina', 'anchoa'],
  marisco: ['marisco', 'gamba', 'langostino', 'camaron', 'mejillon', 'almeja', 'calamar', 'pulpo'],
  carne: ['carne', 'ternera', 'cerdo', 'cordero', 'pollo', 'pavo', 'jamon', 'bacon'],
  'fruto seco': ['fruto seco', 'frutos secos', 'nuez', 'nueces', 'almendra', 'anacardo', 'cacahuete', 'pistacho', 'avellana'],
  lacteo: ['lacteo', 'lacteos', 'leche', 'queso', 'yogur', 'nata', 'mantequilla'],
  gluten: ['gluten', 'trigo', 'cebada', 'centeno', 'espelta'],
  soja: ['soja', 'tofu', 'tempeh', 'edamame'],
  huevo: ['huevo', 'huevos', 'clara de huevo', 'yema de huevo']
});

function exclusionFamily(value) {
  const normalized = normalizeFoodName(value);
  return Object.values(EXCLUSION_FAMILIES).find(terms => terms.some(term => normalizeFoodName(term) === normalized)) || [];
}

export function ingredientMatchesExclusion(ingredientName, excludedName) {
  const ingredient = normalizeFoodName(ingredientName);
  const excluded = normalizeFoodName(excludedName);
  if (!ingredient || !excluded) return false;
  const ingredientWords = new Set(ingredient.split(' '));
  const excludedWords = excluded.split(' ');
  if (excludedWords.every(word => ingredientWords.has(word))) return true;
  const family = exclusionFamily(excluded);
  return family.some(term => {
    const words = normalizeFoodName(term).split(' ');
    return words.every(word => ingredientWords.has(word));
  });
}

export function sameFood(left, right) {
  if (normalizeFoodName(left) !== normalizeFoodName(right)) return false;
  const a = ingredientForm(left);
  const b = ingredientForm(right);
  return !a || !b || a === b;
}

export function convertQuantity(amount, fromUnit, toUnit) {
  const from = UNIT_DEFINITIONS[normalizeUnit(fromUnit)];
  const to = UNIT_DEFINITIONS[normalizeUnit(toUnit)];
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric < 0) throw new TypeError('La cantidad debe ser un número positivo.');
  if (!from || !to) throw new TypeError('Unidad no compatible.');
  if (from.family !== to.family) throw new TypeError('No se puede convertir entre familias de unidades distintas.');
  return numeric * from.factor / to.factor;
}

export function toBaseQuantity(amount, unit) {
  const normalized = normalizeUnit(unit);
  const definition = UNIT_DEFINITIONS[normalized];
  if (!definition) throw new TypeError(`Unidad desconocida: ${unit}`);
  return { amount: convertQuantity(amount, normalized, definition.base), unit: definition.base, family: definition.family };
}

export function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateBMI(weightKg, heightCm) {
  const weight = Number(weightKg);
  const height = Number(heightCm);
  if (!Number.isFinite(weight) || weight <= 0) throw new TypeError('El peso debe ser mayor que cero.');
  if (!Number.isFinite(height) || height < 100 || height > 250) throw new TypeError('La altura debe estar entre 100 y 250 cm.');
  return Math.round((weight / ((height / 100) ** 2)) * 10) / 10;
}

export function classifyAdultBMI(value) {
  const bmi = Number(value);
  if (!Number.isFinite(bmi) || bmi <= 0) throw new TypeError('El IMC debe ser un número positivo.');
  if (bmi < 18.5) return { key: 'below', label: 'Bajo peso' };
  if (bmi < 25) return { key: 'reference', label: 'Peso saludable' };
  if (bmi < 30) return { key: 'above', label: 'Sobrepeso' };
  return { key: 'high', label: 'Obesidad' };
}

export function calculateGoalProgress(startValue, currentValue, targetValue) {
  const start = Number(startValue);
  const current = Number(currentValue);
  const target = Number(targetValue);
  if (![start, current, target].every(value => Number.isFinite(value) && value > 0)) return null;
  const distance = Math.abs(target - start);
  if (distance < 0.01) return { percent: 100, remaining: 0, reached: true };
  const rising = target > start;
  const movement = rising ? current - start : start - current;
  const reached = rising ? current >= target : current <= target;
  return {
    percent: Math.round(Math.max(0, Math.min(100, movement / distance * 100))),
    remaining: reached ? 0 : roundQuantity(Math.abs(target - current)),
    reached
  };
}

export function upsertBodyMeasurement(history = [], measurement = {}) {
  const date = String(measurement.date || '');
  const weightKg = Number(measurement.weightKg);
  const muscleKg = measurement.muscleKg === '' || measurement.muscleKg == null ? null : Number(measurement.muscleKg);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new TypeError('Indica una fecha válida.');
  if (!Number.isFinite(weightKg) || weightKg < 25 || weightKg > 400) throw new TypeError('El peso debe estar entre 25 y 400 kg.');
  if (muscleKg != null && (!Number.isFinite(muscleKg) || muscleKg < 5 || muscleKg > weightKg)) throw new TypeError('La masa muscular debe estar entre 5 kg y el peso corporal.');
  const entry = { id: measurement.id || `body-${date}`, date, weightKg: roundQuantity(weightKg), muscleKg: muscleKg == null ? null : roundQuantity(muscleKg) };
  return [...history.filter(item => item.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date));
}

export function scaleIngredients(recipe, servings) {
  const target = Math.max(1, Number(servings) || recipe.servings || 1);
  const factor = target / (Number(recipe.servings) || 1);
  return recipe.ingredients.map(ingredient => ({ ...ingredient, amount: roundQuantity(ingredient.amount * factor) }));
}

export function recipeTraits(recipe) {
  return new Set(recipe.traits || []);
}

export function isRecipeCompatible(recipe, profile = {}) {
  if (!recipe) return false;
  const blocks = new Set(DIET_BLOCKS[profile.diet] || []);
  if (profile.eatsEgg === false) blocks.add('egg');
  if (profile.eatsDairy === false) blocks.add('dairy');
  const traits = recipeTraits(recipe);
  for (const blocked of blocks) if (traits.has(blocked)) return false;

  const restrictions = [...(profile.allergies || []), ...(profile.restrictions || [])].map(normalizeFoodName).filter(Boolean);
  if (recipe.allergens?.some(allergen => restrictions.some(restriction => ingredientMatchesExclusion(allergen, restriction)))) return false;
  if (recipe.ingredients?.some(ingredient => restrictions.some(restriction => ingredientMatchesExclusion(ingredient.name, restriction)))) return false;

  const dislikes = (profile.dislikes || []).map(normalizeFoodName).filter(Boolean);
  if (recipe.ingredients?.some(ingredient => dislikes.some(dislike => ingredientMatchesExclusion(ingredient.name, dislike)))) return false;

  const equipment = new Set(profile.equipment || []);
  if (equipment.size && recipe.equipment?.some(required => !equipment.has(required))) return false;
  return true;
}

export function getExpiryStatus(dateValue, now = new Date()) {
  if (!dateValue) return { key: 'none', days: null, label: 'Sin fecha' };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = new Date(`${dateValue}T00:00:00`);
  const days = Math.round((expiry - today) / 86400000);
  if (days < 0) return { key: 'expired', days, label: 'Caducado' };
  if (days === 0) return { key: 'today', days, label: 'Caduca hoy' };
  if (days <= 3) return { key: 'soon', days, label: `Caduca en ${days} d` };
  return { key: 'ok', days, label: `${days} días` };
}

export function pantryCoverage(recipe, pantry, servings = recipe.servings) {
  const scaled = scaleIngredients(recipe, servings);
  let covered = 0;
  let missing = 0;
  const details = [];
  for (const ingredient of scaled) {
    const need = toBaseQuantity(ingredient.amount, ingredient.unit);
    const available = pantry.filter(item => sameFood(item.name, ingredient.name)).reduce((sum, item) => {
      try {
        const value = toBaseQuantity(item.quantity, item.unit);
        return value.family === need.family ? sum + value.amount : sum;
      } catch { return sum; }
    }, 0);
    const isCovered = available + 1e-8 >= need.amount;
    if (isCovered) covered += 1; else missing += 1;
    details.push({ name: ingredient.name, required: need.amount, available, unit: need.unit, covered: isCovered });
  }
  return { covered, missing, total: scaled.length, ratio: scaled.length ? covered / scaled.length : 1, details };
}

function seededNoise(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

function scoreRecipe(recipe, context) {
  const { profile, pantry, mode, mealType, used, dayIndex, exercise } = context;
  const targetShare = { breakfast: .22, lunch: .34, snack: .13, dinner: .31 }[mealType];
  const calorieTarget = (profile.calorieTarget || 2000) * targetShare;
  const proteinTarget = (profile.proteinTarget || 100) * targetShare;
  const coverage = pantryCoverage(recipe, pantry, profile.people || recipe.servings).ratio;
  const expiring = recipe.ingredients.reduce((sum, ingredient) => sum + pantry.filter(item => sameFood(item.name, ingredient.name) && ['soon', 'today'].includes(getExpiryStatus(item.expiry).key)).length, 0);
  const estimatedPortionCost = recipe.estimatedCost / recipe.servings * (profile.people || 1);
  const budgetPerMeal = (profile.weeklyBudget || 70) / 28;
  let score = 34;
  score -= Math.abs(recipe.nutrition.kcal - calorieTarget) / 22;
  score -= Math.abs(recipe.nutrition.protein - proteinTarget) / 5;
  score += coverage * 18 + expiring * 9;
  score -= Math.max(0, recipe.totalTime - (profile.maxCookingTime || 35)) * 1.25;
  score -= Math.max(0, estimatedPortionCost - budgetPerMeal) * 3;
  score -= (used.get(recipe.id) || 0) * 17;
  if (profile.diet === 'flexitarian' && !recipeTraits(recipe).has('meat')) score += 4;
  if (mode === 'quick') score -= recipe.totalTime * .75;
  if (mode === 'economic') score -= estimatedPortionCost * 5;
  if (mode === 'pantry') score += coverage * 24;
  if (mode === 'waste') score += expiring * 22;
  if (mode === 'protein') score += recipe.nutrition.protein * .65;
  if (mode === 'surprise') score += seededNoise(`${recipe.id}-${Date.now()}-${dayIndex}`) * 28;
  if (exercise?.intensity === 'high') score += recipe.nutrition.protein * .22 + recipe.nutrition.carbs * .08;
  score += seededNoise(`${recipe.id}-${dayIndex}-${mealType}`) * 5;
  return score;
}

export function generateWeek({ recipes, profile, pantry = [], exercise = [], previousMenu = [], mode = 'balanced' }) {
  const used = new Map();
  const previous = new Map(previousMenu.map(entry => [`${entry.day}-${entry.mealType}`, entry]));
  const result = [];
  for (let day = 0; day < 7; day += 1) {
    for (const mealType of Object.keys(MEAL_LABELS)) {
      const oldEntry = previous.get(`${day}-${mealType}`);
      if (oldEntry?.locked) {
        result.push({ ...oldEntry });
        used.set(oldEntry.recipeId, (used.get(oldEntry.recipeId) || 0) + 1);
        continue;
      }
      const candidates = recipes.filter(recipe => recipe.mealTypes.includes(mealType) && isRecipeCompatible(recipe, profile));
      if (!candidates.length) throw new Error(`No hay recetas compatibles para ${MEAL_LABELS[mealType]}.`);
      const ranked = candidates.map(recipe => ({ recipe, score: scoreRecipe(recipe, { profile, pantry, mode, mealType, used, dayIndex: day, exercise: exercise.find(item => item.day === day) }) })).sort((a, b) => b.score - a.score);
      const recipe = ranked[0].recipe;
      used.set(recipe.id, (used.get(recipe.id) || 0) + 1);
      result.push({ id: `meal-${day}-${mealType}`, day, mealType, recipeId: recipe.id, servings: profile.people || recipe.servings, locked: false });
    }
  }
  return result;
}

export function regenerateMeal({ entry, menu, recipes, profile, pantry, mode = 'balanced' }) {
  if (entry.locked) return menu;
  const used = new Map();
  menu.forEach(item => used.set(item.recipeId, (used.get(item.recipeId) || 0) + 1));
  const candidates = recipes.filter(recipe => recipe.mealTypes.includes(entry.mealType) && recipe.id !== entry.recipeId && isRecipeCompatible(recipe, profile));
  if (!candidates.length) return menu;
  const best = candidates.map(recipe => ({ recipe, score: scoreRecipe(recipe, { profile, pantry, mode, mealType: entry.mealType, used, dayIndex: entry.day }) })).sort((a, b) => b.score - a.score)[0].recipe;
  return menu.map(item => item.id === entry.id ? { ...item, recipeId: best.id } : item);
}

export function rankMealCandidates({ entry, menu, recipes, profile, pantry = [], mode = 'balanced', limit = 100, excludedRecipeIds = [] }) {
  if (!entry) return [];
  const used = new Map();
  for (const item of menu || []) used.set(item.recipeId, (used.get(item.recipeId) || 0) + 1);
  const excluded = new Set([entry.recipeId, ...excludedRecipeIds]);
  return recipes
    .filter(recipe => recipe.mealTypes.includes(entry.mealType) && !excluded.has(recipe.id) && isRecipeCompatible(recipe, profile))
    .map(recipe => ({ recipe, score: scoreRecipe(recipe, { profile, pantry, mode, mealType: entry.mealType, used, dayIndex: entry.day }) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 100)))
    .map(item => item.recipe);
}

function aggregateRequirements(menu, recipes) {
  const grouped = new Map();
  for (const entry of menu) {
    const recipe = recipes.find(item => item.id === entry.recipeId);
    if (!recipe) continue;
    for (const ingredient of scaleIngredients(recipe, entry.servings)) {
      const base = toBaseQuantity(ingredient.amount, ingredient.unit);
      const form = ingredientForm(ingredient.name);
      const key = `${normalizeFoodName(ingredient.name)}|${form}|${base.family}`;
      const current = grouped.get(key) || { id: `shop-${key.replace(/[^a-z0-9]+/g, '-')}`, name: ingredient.name, form, quantity: 0, unit: base.unit, family: base.family, category: ingredient.category || 'otros', source: 'menu' };
      current.quantity += base.amount;
      grouped.set(key, current);
    }
  }
  return grouped;
}

export function buildShoppingList(menu, recipes, pantry) {
  const requirements = aggregateRequirements(menu, recipes);
  const result = [];
  for (const required of requirements.values()) {
    let available = 0;
    for (const item of pantry) {
      if (!sameFood(item.name, required.name)) continue;
      try {
        const base = toBaseQuantity(item.quantity, item.unit);
        if (base.family === required.family) available += base.amount;
      } catch { /* incompatible packaging cannot be subtracted safely */ }
    }
    const missing = roundQuantity(Math.max(0, required.quantity - available));
    if (missing > 0) result.push({ ...required, quantity: missing, required: roundQuantity(required.quantity), available: roundQuantity(available), checked: false });
  }
  return result.sort((a, b) => a.category.localeCompare(b.category, 'es') || a.name.localeCompare(b.name, 'es'));
}

export function consumeRecipe(recipe, servings, pantry) {
  const next = pantry.map(item => ({ ...item }));
  const shortages = [];
  for (const ingredient of scaleIngredients(recipe, servings)) {
    let remaining = toBaseQuantity(ingredient.amount, ingredient.unit).amount;
    const matching = next.filter(item => sameFood(item.name, ingredient.name)).sort((a, b) => String(a.expiry || '9999').localeCompare(String(b.expiry || '9999')));
    for (const item of matching) {
      if (remaining <= 1e-8) break;
      try {
        const base = toBaseQuantity(item.quantity, item.unit);
        const needed = toBaseQuantity(ingredient.amount, ingredient.unit);
        if (base.family !== needed.family) continue;
        const used = Math.min(base.amount, remaining);
        item.quantity = roundQuantity(Math.max(0, item.quantity - convertQuantity(used, base.unit, item.unit)));
        remaining -= used;
      } catch { /* leave ambiguous packages untouched */ }
    }
    if (remaining > 1e-8) shortages.push({ name: ingredient.name, amount: roundQuantity(remaining), unit: toBaseQuantity(ingredient.amount, ingredient.unit).unit });
  }
  return { pantry: next.filter(item => item.quantity > 0), shortages };
}

export function upsertPantryItem(pantry, incoming) {
  const next = pantry.map(item => ({ ...item }));
  const existing = next.find(item => sameFood(item.name, incoming.name) && normalizeUnit(item.unit) === normalizeUnit(incoming.unit) && (item.expiry || '') === (incoming.expiry || ''));
  if (existing) existing.quantity = roundQuantity(existing.quantity + Number(incoming.quantity));
  else next.push({ id: incoming.id || `pantry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, minQuantity: 0, location: 'pantry', ...incoming, quantity: Number(incoming.quantity), unit: normalizeUnit(incoming.unit) });
  return next;
}

export function menuNutrition(entries, recipes) {
  return entries.reduce((total, entry) => {
    const recipe = recipes.find(item => item.id === entry.recipeId);
    if (!recipe) return total;
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber']) total[key] += (recipe.nutrition[key] || 0);
    total.cost += recipe.estimatedCost / recipe.servings * entry.servings;
    return total;
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0 });
}

export function validateRecipe(recipe) {
  const errors = [];
  if (!String(recipe.name || '').trim()) errors.push('Añade un nombre.');
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) errors.push('Añade al menos un ingrediente.');
  if (recipe.ingredients?.some(item => !(Number(item.amount) > 0) || !UNIT_DEFINITIONS[normalizeUnit(item.unit)])) errors.push('Revisa cantidades y unidades.');
  if (!(Number(recipe.servings) > 0)) errors.push('Las raciones deben ser mayores que cero.');
  return errors;
}
