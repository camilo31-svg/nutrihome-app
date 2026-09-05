const ing = (name, amount, unit, category = 'otros') => ({ name, amount, unit, category });
const n = (kcal, protein, carbs, fat, fiber) => ({ kcal, protein, carbs, fat, fiber });
const recipe = (id, name, emoji, mealTypes, totalTime, servings, nutrition, estimatedCost, ingredients, options = {}) => ({
  id, name, emoji, mealTypes, totalTime, prepTime: Math.max(5, totalTime - (options.cookTime || 10)), cookTime: options.cookTime || 10,
  servings, nutrition, estimatedCost, ingredients, description: options.description || 'Una receta sencilla, equilibrada y pensada para el día a día.',
  steps: options.steps || ['Prepara y mide todos los ingredientes.', 'Cocina siguiendo el orden indicado hasta que todo esté en su punto.', 'Ajusta el aliño, sirve y disfruta.'],
  traits: options.traits || [], allergens: options.allergens || [], equipment: options.equipment || [], tags: options.tags || [],
  rating: options.rating || 4.6, ratingCount: options.ratingCount || 0, ratingType: options.ratingType || 'system_estimate', source: 'Datos de demostración NutriHome'
});

export const DEMO_RECIPES = [
  recipe('rec-avena-pera', 'Avena cremosa con pera', '🥣', ['breakfast'], 10, 1, n(420, 22, 55, 12, 9), 1.55, [ing('avena', 60, 'g', 'cereales'), ing('leche de soja', 220, 'ml', 'bebidas'), ing('pera', 1, 'unidad', 'frutas'), ing('semillas de chía', 10, 'g', 'semillas')], { traits: ['soy'], allergens: ['soja'], tags: ['rápida', 'vegana', 'fibra', 'sin huevo'], description: 'Avena cálida con pera, canela y chía; saciante sin resultar pesada.', cookTime: 5 }),
  recipe('rec-tostada-hummus', 'Tostadas de hummus y tomate', '🍅', ['breakfast'], 8, 1, n(390, 18, 52, 13, 10), 1.7, [ing('pan integral', 80, 'g', 'cereales'), ing('hummus', 70, 'g', 'refrigerados'), ing('tomate', 120, 'g', 'verduras')], { traits: ['gluten', 'sesame'], allergens: ['gluten', 'sésamo'], tags: ['muy rápida', 'vegana', 'económica', 'sin huevo'], cookTime: 3 }),
  recipe('rec-yogur-granola', 'Yogur con granola y frutos rojos', '🫐', ['breakfast', 'snack'], 5, 1, n(355, 23, 41, 11, 6), 1.95, [ing('yogur natural', 200, 'g', 'refrigerados'), ing('granola', 35, 'g', 'cereales'), ing('arándanos', 80, 'g', 'frutas')], { traits: ['dairy', 'gluten'], allergens: ['lácteos', 'gluten'], tags: ['muy rápida', 'vegetariana', 'alta proteína', 'sin huevo'], cookTime: 0 }),
  recipe('rec-revuelto-tofu', 'Revuelto de tofu y espinacas', '🍳', ['breakfast', 'dinner'], 15, 2, n(330, 28, 18, 17, 7), 3.4, [ing('tofu firme', 300, 'g', 'refrigerados'), ing('espinacas frescas', 160, 'g', 'verduras'), ing('tomate', 160, 'g', 'verduras'), ing('pan integral', 80, 'g', 'cereales')], { traits: ['soy', 'gluten'], allergens: ['soja', 'gluten'], tags: ['rápida', 'vegana', 'alta proteína', 'sin huevo'], cookTime: 8 }),
  recipe('rec-tortilla-espinaca', 'Tortilla de espinacas y patata', '🥔', ['breakfast', 'dinner'], 25, 2, n(405, 25, 38, 17, 6), 3.1, [ing('huevos', 4, 'unidad', 'refrigerados'), ing('patatas', 320, 'g', 'verduras'), ing('espinacas', 120, 'g', 'verduras'), ing('cebolla', 80, 'g', 'verduras')], { traits: ['egg'], allergens: ['huevo'], tags: ['vegetariana', 'económica'], cookTime: 17 }),
  recipe('rec-chia-cacao', 'Pudin de chía y cacao', '🍫', ['breakfast', 'snack'], 10, 2, n(345, 16, 35, 17, 12), 2.8, [ing('semillas de chía', 55, 'g', 'semillas'), ing('leche vegetal', 400, 'ml', 'bebidas'), ing('cacao puro', 12, 'g', 'otros'), ing('plátano', 1, 'unidad', 'frutas')], { tags: ['vegana', 'sin huevo', 'meal prep'], cookTime: 0, description: 'Se prepara en diez minutos y reposa en frío; perfecto para adelantar desayunos.' }),

  recipe('rec-bowl-garbanzos', 'Bowl mediterráneo de garbanzos', '🥙', ['lunch', 'dinner'], 20, 2, n(548, 27, 68, 18, 15), 4.2, [ing('garbanzos cocidos', 320, 'g', 'legumbres'), ing('arroz integral', 140, 'g', 'cereales'), ing('tomate', 200, 'g', 'verduras'), ing('pepino', 160, 'g', 'verduras'), ing('limón', 1, 'unidad', 'frutas')], { tags: ['vegana', 'sin huevo', 'económica', 'fibra'], cookTime: 12, description: 'Un bol fresco y completo que aprovecha legumbres cocidas y verduras de temporada.' }),
  recipe('rec-lentejas-arroz', 'Lentejas especiadas con arroz', '🍛', ['lunch'], 30, 3, n(585, 29, 89, 12, 18), 4.5, [ing('lentejas cocidas', 480, 'g', 'legumbres'), ing('arroz', 210, 'g', 'cereales'), ing('tomate triturado', 300, 'g', 'conservas'), ing('cebolla', 120, 'g', 'verduras'), ing('zanahoria', 180, 'g', 'verduras')], { tags: ['vegana', 'económica', 'batch cooking', 'sin huevo'], cookTime: 22 }),
  recipe('rec-pasta-atun', 'Pasta integral con atún y tomate', '🍝', ['lunch'], 22, 2, n(610, 43, 77, 15, 10), 4.8, [ing('pasta integral', 180, 'g', 'cereales'), ing('atún en conserva', 2, 'lata', 'conservas'), ing('tomate triturado', 240, 'g', 'conservas'), ing('espinacas', 100, 'g', 'verduras')], { traits: ['fish', 'gluten'], allergens: ['pescado', 'gluten'], tags: ['pescetariana', 'alta proteína', 'rápida'], cookTime: 14 }),
  recipe('rec-pollo-quinoa', 'Pollo al limón con quinoa', '🍋', ['lunch', 'dinner'], 28, 2, n(570, 51, 55, 16, 8), 6.9, [ing('pechuga de pollo', 320, 'g', 'carnes'), ing('quinoa', 150, 'g', 'cereales'), ing('calabacín', 220, 'g', 'verduras'), ing('limón', 1, 'unidad', 'frutas')], { traits: ['meat'], tags: ['alta proteína', 'sin huevo'], cookTime: 20 }),
  recipe('rec-curry-tofu', 'Curry rápido de tofu y coco', '🥥', ['lunch', 'dinner'], 25, 3, n(520, 30, 52, 23, 10), 6.3, [ing('tofu firme', 420, 'g', 'refrigerados'), ing('leche de coco', 300, 'ml', 'conservas'), ing('arroz', 180, 'g', 'cereales'), ing('espinacas', 180, 'g', 'verduras')], { traits: ['soy'], allergens: ['soja'], tags: ['vegana', 'alta proteína', 'sin huevo'], cookTime: 17 }),
  recipe('rec-pasta-alubias', 'Pasta cremosa de alubias blancas', '🫘', ['lunch'], 25, 3, n(560, 31, 82, 13, 17), 4.9, [ing('pasta integral', 240, 'g', 'cereales'), ing('alubias blancas', 360, 'g', 'legumbres'), ing('tomate', 250, 'g', 'verduras'), ing('ajo', 2, 'unidad', 'verduras')], { traits: ['gluten'], allergens: ['gluten'], tags: ['vegana', 'alta proteína', 'económica', 'sin huevo'], cookTime: 15 }),

  recipe('rec-yogur-nueces', 'Yogur, nueces y arándanos', '🫐', ['snack'], 5, 1, n(275, 18, 25, 11, 4), 1.65, [ing('yogur natural', 170, 'g', 'refrigerados'), ing('nueces', 15, 'g', 'frutos secos'), ing('arándanos', 70, 'g', 'frutas')], { traits: ['dairy', 'nuts'], allergens: ['lácteos', 'frutos secos'], tags: ['muy rápida', 'vegetariana', 'sin huevo'], cookTime: 0 }),
  recipe('rec-hummus-zanahoria', 'Hummus con bastones de zanahoria', '🥕', ['snack'], 7, 1, n(250, 11, 30, 10, 9), 1.25, [ing('hummus', 90, 'g', 'refrigerados'), ing('zanahoria', 180, 'g', 'verduras')], { traits: ['sesame'], allergens: ['sésamo'], tags: ['muy rápida', 'vegana', 'económica', 'sin huevo'], cookTime: 0 }),
  recipe('rec-batido-soja', 'Batido de soja, plátano y avena', '🥤', ['breakfast', 'snack'], 5, 1, n(365, 24, 54, 8, 7), 1.4, [ing('leche de soja', 300, 'ml', 'bebidas'), ing('plátano', 1, 'unidad', 'frutas'), ing('avena', 35, 'g', 'cereales')], { traits: ['soy'], allergens: ['soja'], equipment: ['blender'], tags: ['muy rápida', 'vegana', 'alta proteína', 'sin huevo'], cookTime: 0 }),
  recipe('rec-manzana-cacahuete', 'Manzana con crema de cacahuete', '🍎', ['snack'], 3, 1, n(265, 8, 31, 14, 7), 1.0, [ing('manzana', 1, 'unidad', 'frutas'), ing('crema de cacahuete', 28, 'g', 'frutos secos')], { traits: ['nuts'], allergens: ['cacahuete'], tags: ['muy rápida', 'vegana', 'económica', 'sin huevo'], cookTime: 0 }),
  recipe('rec-tostada-queso', 'Tostada de queso fresco y uvas', '🍇', ['snack'], 6, 1, n(290, 17, 39, 8, 5), 1.75, [ing('pan integral', 60, 'g', 'cereales'), ing('queso fresco', 70, 'g', 'refrigerados'), ing('uvas', 90, 'g', 'frutas')], { traits: ['dairy', 'gluten'], allergens: ['lácteos', 'gluten'], tags: ['muy rápida', 'vegetariana', 'sin huevo'], cookTime: 2 }),
  recipe('rec-bolas-avena', 'Bolas de avena y dátil', '🌰', ['snack'], 15, 6, n(210, 7, 29, 9, 5), 2.7, [ing('avena', 120, 'g', 'cereales'), ing('dátiles', 150, 'g', 'frutas'), ing('almendras', 60, 'g', 'frutos secos')], { traits: ['nuts'], allergens: ['frutos secos'], equipment: ['blender'], tags: ['vegana', 'meal prep', 'sin huevo'], cookTime: 0 }),

  recipe('rec-tofu-verduras', 'Tofu crujiente con verduras', '🥦', ['dinner'], 25, 2, n(603, 42, 61, 21, 13), 5.2, [ing('tofu firme', 360, 'g', 'refrigerados'), ing('brócoli', 300, 'g', 'verduras'), ing('pimiento rojo', 180, 'g', 'verduras'), ing('arroz', 130, 'g', 'cereales'), ing('salsa de soja', 25, 'ml', 'condimentos')], { traits: ['soy'], allergens: ['soja'], tags: ['vegana', 'alta proteína', 'sin huevo'], cookTime: 17 }),
  recipe('rec-salmon-boniato', 'Salmón con boniato y judías verdes', '🐟', ['dinner'], 30, 2, n(580, 44, 48, 24, 9), 9.4, [ing('salmón', 300, 'g', 'pescados'), ing('boniato', 400, 'g', 'verduras'), ing('judías verdes', 260, 'g', 'verduras')], { traits: ['fish'], allergens: ['pescado'], equipment: ['oven'], tags: ['pescetariana', 'alta proteína', 'sin huevo'], cookTime: 22 }),
  recipe('rec-crema-calabacin', 'Crema de calabacín con alubias', '🥒', ['dinner'], 25, 3, n(395, 21, 52, 11, 15), 3.8, [ing('calabacín', 700, 'g', 'verduras'), ing('alubias blancas', 300, 'g', 'legumbres'), ing('cebolla', 120, 'g', 'verduras'), ing('caldo vegetal', 600, 'ml', 'conservas')], { equipment: ['blender'], tags: ['vegana', 'económica', 'sin huevo', 'batch cooking'], cookTime: 18 }),
  recipe('rec-tortilla-patata', 'Tortilla de patata ligera', '🍳', ['dinner'], 35, 3, n(455, 26, 42, 20, 5), 4.0, [ing('huevos', 6, 'unidad', 'refrigerados'), ing('patatas', 600, 'g', 'verduras'), ing('cebolla', 140, 'g', 'verduras')], { traits: ['egg'], allergens: ['huevo'], tags: ['vegetariana', 'económica'], cookTime: 27 }),
  recipe('rec-tacos-alubia', 'Tacos de alubias negras y maíz', '🌮', ['lunch', 'dinner'], 20, 3, n(495, 24, 72, 13, 18), 4.6, [ing('tortillas de maíz', 6, 'unidad', 'cereales'), ing('alubias negras', 420, 'g', 'legumbres'), ing('maíz', 180, 'g', 'conservas'), ing('tomate', 180, 'g', 'verduras')], { tags: ['vegana', 'económica', 'rápida', 'sin huevo'], cookTime: 10 }),
  recipe('rec-wok-tempeh', 'Wok de tempeh, arroz y verduras', '🥢', ['dinner'], 24, 2, n(565, 38, 67, 18, 12), 6.1, [ing('tempeh', 300, 'g', 'refrigerados'), ing('arroz', 140, 'g', 'cereales'), ing('brócoli', 240, 'g', 'verduras'), ing('pimiento', 160, 'g', 'verduras'), ing('salsa de soja', 25, 'ml', 'condimentos')], { traits: ['soy'], allergens: ['soja'], tags: ['vegana', 'alta proteína', 'sin huevo'], cookTime: 16 }),
  recipe('rec-ensalada-quinoa', 'Ensalada tibia de quinoa y edamame', '🥗', ['lunch', 'dinner'], 20, 2, n(505, 29, 65, 17, 14), 5.6, [ing('quinoa', 150, 'g', 'cereales'), ing('edamame', 240, 'g', 'congelados'), ing('espinacas', 140, 'g', 'verduras'), ing('tomate', 180, 'g', 'verduras')], { traits: ['soy'], allergens: ['soja'], tags: ['vegana', 'alta proteína', 'sin huevo'], cookTime: 12 })
];

const futureDate = days => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function createDemoPantry() {
  return [
    { id: 'pantry-rice', name: 'arroz', quantity: 520, unit: 'g', minQuantity: 250, category: 'cereales', location: 'pantry', expiry: futureDate(150), price: 1.65 },
    { id: 'pantry-chickpea', name: 'garbanzos cocidos', quantity: 500, unit: 'g', minQuantity: 200, category: 'legumbres', location: 'pantry', expiry: futureDate(80), price: 1.2 },
    { id: 'pantry-tomato', name: 'tomate', quantity: 420, unit: 'g', minQuantity: 200, category: 'verduras', location: 'fridge', expiry: futureDate(2), price: 1.8 },
    { id: 'pantry-spinach', name: 'espinacas frescas', quantity: 180, unit: 'g', minQuantity: 100, category: 'verduras', location: 'fridge', expiry: futureDate(1), price: 1.6 },
    { id: 'pantry-tofu', name: 'tofu firme', quantity: 400, unit: 'g', minQuantity: 200, category: 'refrigerados', location: 'fridge', expiry: futureDate(3), price: 2.4 },
    { id: 'pantry-oats', name: 'avena', quantity: 430, unit: 'g', minQuantity: 150, category: 'cereales', location: 'pantry', expiry: futureDate(120), price: 1.4 },
    { id: 'pantry-soy', name: 'leche de soja', quantity: 750, unit: 'ml', minQuantity: 500, category: 'bebidas', location: 'fridge', expiry: futureDate(5), price: 1.2 },
    { id: 'pantry-onion', name: 'cebolla', quantity: 260, unit: 'g', minQuantity: 300, category: 'verduras', location: 'pantry', expiry: futureDate(12), price: 0.8 },
    { id: 'pantry-blueberry', name: 'arándanos', quantity: 110, unit: 'g', minQuantity: 80, category: 'frutas', location: 'fridge', expiry: futureDate(2), price: 2.2 },
    { id: 'pantry-yogurt', name: 'yogur natural', quantity: 300, unit: 'g', minQuantity: 200, category: 'refrigerados', location: 'fridge', expiry: futureDate(4), price: 1.4 },
    { id: 'pantry-potato', name: 'patatas', quantity: 900, unit: 'g', minQuantity: 500, category: 'verduras', location: 'pantry', expiry: futureDate(18), price: 1.2 },
    { id: 'pantry-carrot', name: 'zanahoria', quantity: 240, unit: 'g', minQuantity: 200, category: 'verduras', location: 'fridge', expiry: futureDate(6), price: 0.7 }
  ];
}

export const DEFAULT_PROFILE = {
  configured: false, diet: 'vegetarian', eatsEgg: false, eatsDairy: true,
  allergies: [], restrictions: [], dislikes: [], calorieTarget: 2050, proteinTarget: 110,
  carbTarget: 245, fatTarget: 68, weeklyBudget: 65, monthlyBudget: 260, people: 2,
  maxCookingTime: 30, supermarket: '', equipment: ['oven', 'microwave', 'blender'], notifications: { expiry: true, lowStock: true, planning: false }
};

export const DEMO_EXERCISE = [
  { id: 'ex-1', day: 1, type: 'Fuerza', duration: 50, intensity: 'high', calories: 320 },
  { id: 'ex-2', day: 3, type: 'Carrera suave', duration: 35, intensity: 'medium', calories: 280 },
  { id: 'ex-3', day: 5, type: 'Movilidad', duration: 25, intensity: 'low', calories: 90 }
];
