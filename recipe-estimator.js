import { normalizeText, roundQuantity } from './nutrihome-core.js';

// Valores orientativos por 100 g y precios medios configurados solo para estimar.
// NutriHome los presenta como una ayuda editable, nunca como información de etiqueta.
const FOOD_PROFILES = [
  ['aceite de oliva|aceite', 884, 0, 0, 100, 0, 9.5, 12, 'g', 1, 'otros'],
  ['aguacate', 160, 2, 8.5, 14.7, 6.7, 5.5, 70, 'g', 150, 'frutas'],
  ['arroz integral|arroz basmati|arroz', 360, 7.5, 78, 2.7, 2.8, 2.2, 80, 'g', 1, 'cereales'],
  ['avena|copos de avena', 379, 13.2, 67.7, 6.5, 10.1, 2.4, 55, 'g', 1, 'cereales'],
  ['pan integral|pan', 252, 12, 43, 3.5, 6, 3.2, 65, 'g', 35, 'cereales'],
  ['pasta integral|espagueti|macarron|pasta', 350, 13, 70, 2.5, 7, 2, 85, 'g', 1, 'cereales'],
  ['quinoa', 368, 14.1, 64.2, 6.1, 7, 5.5, 75, 'g', 1, 'cereales'],
  ['cuscus|couscous', 376, 12.8, 77.4, 0.6, 5, 2.7, 80, 'g', 1, 'cereales'],
  ['patata|papa', 77, 2, 17, 0.1, 2.2, 1.5, 220, 'g', 180, 'verduras'],
  ['boniato|batata', 86, 1.6, 20.1, 0.1, 3, 2.4, 180, 'g', 180, 'verduras'],
  ['garbanzo|garbanzos', 164, 8.9, 27.4, 2.6, 7.6, 2.4, 130, 'g', 1, 'legumbres'],
  ['lenteja|lentejas', 116, 9, 20.1, 0.4, 7.9, 2.6, 140, 'g', 1, 'legumbres'],
  ['alubia|judia blanca|frijol', 127, 8.7, 22.8, 0.5, 6.4, 2.8, 135, 'g', 1, 'legumbres'],
  ['tofu', 144, 17.3, 2.8, 8.7, 2.3, 6.5, 140, 'g', 1, 'refrigerados'],
  ['tempeh', 195, 19.9, 7.6, 11.4, 3.5, 10, 120, 'g', 1, 'refrigerados'],
  ['soja texturizada', 330, 50, 30, 1.2, 14, 8, 55, 'g', 1, 'legumbres'],
  ['huevo|huevos', 143, 12.6, 0.7, 9.5, 0, 4.2, 1, 'unidad', 60, 'refrigerados'],
  ['leche de soja|bebida de soja', 43, 3.3, 4.9, 1.8, 0.6, 1.6, 200, 'ml', 1, 'bebidas'],
  ['leche|bebida vegetal', 50, 3.3, 4.8, 2, 0, 1.3, 200, 'ml', 1, 'bebidas'],
  ['yogur griego|yogur', 73, 9.5, 3.8, 2.1, 0, 3.2, 125, 'g', 1, 'refrigerados'],
  ['queso feta|queso', 265, 14.2, 3.9, 21.5, 0, 11, 35, 'g', 1, 'refrigerados'],
  ['pollo|pechuga de pollo', 165, 31, 0, 3.6, 0, 8.5, 160, 'g', 1, 'refrigerados'],
  ['pavo', 135, 29, 0, 1.6, 0, 9, 160, 'g', 1, 'refrigerados'],
  ['ternera|carne picada|carne', 215, 26, 0, 12, 0, 13, 150, 'g', 1, 'refrigerados'],
  ['salmon', 208, 20, 0, 13, 0, 18, 160, 'g', 1, 'refrigerados'],
  ['atun', 132, 29, 0, 1.3, 0, 12, 140, 'g', 1, 'conservas'],
  ['merluza|bacalao|pescado', 90, 19, 0, 1.2, 0, 12, 170, 'g', 1, 'refrigerados'],
  ['gamba|langostino', 99, 24, 0.2, 0.3, 0, 16, 140, 'g', 1, 'congelados'],
  ['tomate cherry|tomate', 18, 0.9, 3.9, 0.2, 1.2, 2.5, 130, 'g', 120, 'verduras'],
  ['cebolla', 40, 1.1, 9.3, 0.1, 1.7, 1.7, 70, 'g', 120, 'verduras'],
  ['ajo', 149, 6.4, 33, 0.5, 2.1, 6, 0.5, 'unidad', 5, 'verduras'],
  ['zanahoria', 41, 0.9, 9.6, 0.2, 2.8, 1.5, 80, 'g', 100, 'verduras'],
  ['calabacin', 17, 1.2, 3.1, 0.3, 1, 2, 130, 'g', 200, 'verduras'],
  ['berenjena', 25, 1, 6, 0.2, 3, 2.4, 140, 'g', 280, 'verduras'],
  ['brocoli', 34, 2.8, 6.6, 0.4, 2.6, 3.4, 140, 'g', 1, 'verduras'],
  ['espinaca', 23, 2.9, 3.6, 0.4, 2.2, 4.2, 85, 'g', 1, 'verduras'],
  ['pimiento', 31, 1, 6, 0.3, 2.1, 3, 90, 'g', 160, 'verduras'],
  ['pepino', 15, 0.7, 3.6, 0.1, 0.5, 2, 100, 'g', 220, 'verduras'],
  ['champinon|seta', 22, 3.1, 3.3, 0.3, 1, 5.5, 110, 'g', 1, 'verduras'],
  ['maiz', 96, 3.4, 21, 1.5, 2.4, 3.2, 75, 'g', 1, 'conservas'],
  ['guisante', 81, 5.4, 14.5, 0.4, 5.1, 3, 90, 'g', 1, 'congelados'],
  ['platano|banana', 89, 1.1, 22.8, 0.3, 2.6, 2.2, 1, 'unidad', 120, 'frutas'],
  ['manzana|pera', 55, 0.3, 14.5, 0.2, 2.5, 2.4, 1, 'unidad', 180, 'frutas'],
  ['fresa|frutos rojos|arandano', 42, 0.7, 10, 0.3, 3.2, 7.5, 100, 'g', 1, 'frutas'],
  ['naranja|mandarina', 47, 0.9, 11.8, 0.1, 2.4, 2.2, 1, 'unidad', 180, 'frutas'],
  ['nuez|nueces', 654, 15.2, 13.7, 65.2, 6.7, 17, 25, 'g', 1, 'otros'],
  ['almendra|anacardo|fruto seco', 590, 20, 22, 50, 10, 16, 25, 'g', 1, 'otros'],
  ['semilla de chia|chia', 486, 16.5, 42.1, 30.7, 34.4, 13, 14, 'g', 1, 'otros'],
  ['mantequilla de cacahuete|crema de cacahuete', 588, 25, 20, 50, 6, 8, 20, 'g', 1, 'otros'],
  ['tortilla de trigo|tortilla de maiz|tortilla', 300, 8, 52, 7, 5, 5.5, 2, 'unidad', 45, 'cereales'],
  ['harina', 364, 10, 76, 1, 3, 1.2, 70, 'g', 1, 'cereales'],
  ['azucar|miel', 390, 0.2, 98, 0, 0, 4, 12, 'g', 1, 'otros'],
  ['sal', 0, 0, 0, 0, 0, 0.8, 2, 'g', 1, 'otros'],
  ['pimienta|pimenton|comino|curcuma|curry|canela|oregano|especia', 280, 10, 45, 8, 25, 22, 2, 'g', 1, 'otros'],
  ['perejil|cilantro|albahaca|hierba fresca', 35, 3, 6, 0.8, 4, 18, 5, 'g', 1, 'verduras'],
  ['limon|lima', 29, 1.1, 9.3, 0.3, 2.8, 3, 0.5, 'unidad', 100, 'frutas'],
  ['caldo|agua', 5, 0.2, 0.5, 0, 0, 0.4, 200, 'ml', 1, 'bebidas']
].map(([aliases, kcal, protein, carbs, fat, fiber, costPerKg, portion, defaultUnit, unitGrams, category]) => ({
  aliases: aliases.split('|').map(normalizeText), kcal, protein, carbs, fat, fiber, costPerKg, portion, defaultUnit, unitGrams, category
}));

const UNIT_ALIASES = new Map([
  ['mg', 'mg'], ['miligramo', 'mg'], ['miligramos', 'mg'], ['g', 'g'], ['gr', 'g'], ['gramo', 'g'], ['gramos', 'g'],
  ['kg', 'kg'], ['kilo', 'kg'], ['kilos', 'kg'], ['ml', 'ml'], ['mililitro', 'ml'], ['mililitros', 'ml'], ['cl', 'cl'],
  ['l', 'l'], ['litro', 'l'], ['litros', 'l'], ['unidad', 'unidad'], ['unidades', 'unidad'], ['ud', 'unidad'], ['uds', 'unidad'],
  ['paquete', 'paquete'], ['paquetes', 'paquete'], ['lata', 'lata'], ['latas', 'lata'], ['botella', 'botella'], ['botellas', 'botella']
]);

const MEASURE_GRAMS = { cucharadita: 5, cucharaditas: 5, cucharada: 15, cucharadas: 15, taza: 200, tazas: 200, punado: 30, punados: 30, rebanada: 35, rebanadas: 35 };
const FALLBACK = { kcal: 90, protein: 3, carbs: 14, fat: 2.5, fiber: 2, costPerKg: 4, portion: 100, defaultUnit: 'g', unitGrams: 1, category: 'otros', aliases: [] };

function numberFromToken(token) {
  const value = String(token).replace(',', '.').trim();
  if (value.includes('/')) { const [a, b] = value.split('/').map(Number); return b ? a / b : NaN; }
  return Number(value);
}

function findProfile(name) {
  const normalized = normalizeText(name);
  return FOOD_PROFILES.find(profile => profile.aliases.some(alias => normalized.includes(alias))) || FALLBACK;
}

function normalizeInputUnit(rawUnit = '') {
  const normalized = normalizeText(rawUnit);
  return UNIT_ALIASES.get(normalized) || normalized;
}

function gramsFor(amount, unit, profile) {
  if (unit === 'mg') return amount / 1000;
  if (unit === 'kg') return amount * 1000;
  if (unit === 'g' || unit === 'ml') return amount;
  if (unit === 'cl') return amount * 10;
  if (unit === 'l') return amount * 1000;
  if (unit === 'unidad') return amount * (profile.unitGrams || 100);
  if (unit === 'lata') return amount * 400;
  if (unit === 'paquete') return amount * 250;
  if (unit === 'botella') return amount * 750;
  return amount;
}

export function parseFlexibleIngredient(line, servings = 2) {
  const raw = String(line || '').trim().replace(/^[-•]\s*/, '');
  if (!raw) return null;
  const quantityToken = '(\\d+(?:[.,]\\d+)?|\\d+\\s*\\/\\s*\\d+)';
  const unitToken = '(mg|miligramos?|kg|kilos?|g|gr|gramos?|ml|mililitros?|cl|l|litros?|unidades?|uds?|paquetes?|latas?|botellas?|cucharaditas?|cucharadas?|tazas?|puñados?|rebanadas?)';
  let amount = null;
  let rawUnit = '';
  let name = raw;
  let inferred = true;
  const prefix = raw.match(new RegExp(`^${quantityToken}\\s*${unitToken}?\\s*(?:de\\s+)?(.+)$`, 'i'));
  const suffix = raw.match(new RegExp(`^(.+?)\\s+${quantityToken}\\s*${unitToken}$`, 'i'));
  if (prefix) {
    amount = numberFromToken(prefix[1]); rawUnit = prefix[2] || ''; name = prefix[3].trim(); inferred = !rawUnit;
  } else if (suffix) {
    name = suffix[1].trim(); amount = numberFromToken(suffix[2]); rawUnit = suffix[3]; inferred = false;
  }
  const profile = findProfile(name);
  let unit = normalizeInputUnit(rawUnit);
  const measureKey = normalizeText(rawUnit);
  if (MEASURE_GRAMS[measureKey]) {
    amount = roundQuantity(amount * MEASURE_GRAMS[measureKey]); unit = 'g'; inferred = true;
  } else if (amount == null) {
    amount = roundQuantity(profile.portion * Math.max(1, Number(servings) || 1));
    unit = profile.defaultUnit;
    inferred = true;
  } else if (!unit) {
    unit = profile.defaultUnit === 'unidad' ? 'unidad' : 'g';
    inferred = true;
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { name, amount: roundQuantity(amount), unit, category: profile.category, inferred, confidence: profile === FALLBACK ? 'low' : inferred ? 'medium' : 'high' };
}

export function parseFlexibleIngredients(text, servings = 2) {
  return String(text || '').split(/\r?\n|;/).map(line => parseFlexibleIngredient(line, servings)).filter(Boolean);
}

export function estimateRecipe(ingredients, servings = 2) {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0 };
  let lowConfidence = 0;
  for (const ingredient of ingredients || []) {
    const profile = findProfile(ingredient.name);
    const grams = gramsFor(Number(ingredient.amount), ingredient.unit, profile);
    for (const key of ['kcal', 'protein', 'carbs', 'fat', 'fiber']) totals[key] += grams / 100 * profile[key];
    totals.cost += grams / 1000 * profile.costPerKg;
    if (ingredient.confidence === 'low' || profile === FALLBACK) lowConfidence += 1;
  }
  const portions = Math.max(1, Number(servings) || 1);
  return {
    nutrition: Object.fromEntries(['kcal', 'protein', 'carbs', 'fat', 'fiber'].map(key => [key, roundQuantity(totals[key] / portions)])),
    estimatedCost: roundQuantity(totals.cost), lowConfidence,
    inferredCount: (ingredients || []).filter(item => item.inferred).length
  };
}

export function inferRecipeTraits(ingredients) {
  const text = normalizeText((ingredients || []).map(item => item.name).join(' '));
  const dairyText = text.replace(/leche de soja|bebida de soja|bebida vegetal|mantequilla de cacahuete|crema de cacahuete/g, '');
  const rules = {
    meat: /pollo|pavo|ternera|carne|cerdo|jamon|cordero/,
    fish: /salmon|atun|merluza|bacalao|pescado|gamba|langostino|marisco/,
    egg: /huevo/,
    dairy: /leche|yogur|queso|nata|mantequilla/.test(dairyText),
    soy: /soja|tofu|tempeh/,
    gluten: /trigo|pan|pasta|cuscus|harina|cebada|centeno/,
    nuts: /nuez|almendra|anacardo|avellana|cacahuete|pistacho/
  };
  return Object.entries(rules).filter(([, pattern]) => typeof pattern === 'boolean' ? pattern : pattern.test(text)).map(([trait]) => trait);
}
