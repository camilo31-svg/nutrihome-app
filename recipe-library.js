import { DEMO_RECIPES } from './demo-data.js';

const ingredient = (name, amount, unit, category = 'otros') => ({ name, amount, unit, category });
const rounded = value => Math.round(value * 10) / 10;

const REFERENCE_NOTE = 'Adaptación original NutriHome en castellano, inspirada en técnicas culinarias tradicionales y recetarios de dominio público.';

export const CATALOG_REFERENCES = Object.freeze([
  { title: 'Dr. Allinson’s Cookery Book', url: 'https://www.gutenberg.org/ebooks/13887', note: 'Recetario vegetariano en inglés, dominio público en EE. UU.' },
  { title: 'Cassell’s Vegetarian Cookery', url: 'https://www.gutenberg.org/ebooks/14594', note: 'Manual vegetariano en inglés, dominio público en EE. UU.' },
  { title: 'New Vegetarian Dishes', url: 'https://www.gutenberg.org/ebooks/27639', note: 'Más de 200 preparaciones vegetarianas, dominio público en EE. UU.' },
  { title: 'Substitutes for Flesh Foods', url: 'https://www.gutenberg.org/ebooks/43879', note: 'Colección vegetariana histórica, dominio público en EE. UU.' },
  { title: 'Leaves from Our Tuscan Kitchen', url: 'https://www.gutenberg.org/ebooks/69370', note: 'Técnicas vegetales toscanas, dominio público en EE. UU.' },
  { title: 'The Khaki Kook Book', url: 'https://www.gutenberg.org/ebooks/45863', note: 'Recetas históricas inspiradas en la cocina de India, dominio público en EE. UU.' },
  { title: 'La Cuisine Creole', url: 'https://www.gutenberg.org/ebooks/75027', note: 'Recetario criollo de 1885, dominio público en EE. UU.' },
  { title: 'Cookery and Dining in Imperial Rome', url: 'https://www.gutenberg.org/ebooks/29728', note: 'Traducción inglesa de Apicio, dominio público en EE. UU.' },
  { title: 'MyPlate Kitchen', url: 'https://www.myplate.gov/myplate-kitchen', note: 'Colección oficial de recetas y planificación alimentaria del USDA.' }
]);

function recipe({ id, name, emoji, mealTypes, totalTime, prepTime = 8, cookTime, servings = 2, nutrition, estimatedCost, ingredients, description, steps, traits = [], allergens = [], equipment = [], tags = [], tradition }) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    id, name, emoji, mealTypes, totalTime, prepTime, cookTime: cookTime ?? Math.max(0, totalTime - prepTime), servings,
    nutrition: Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, rounded(value)])),
    estimatedCost: rounded(estimatedCost), ingredients, description, steps, traits: [...new Set(traits)], allergens: [...new Set(allergens)], equipment, tags,
    rating: rounded(4.2 + (seed % 7) / 10), ratingCount: 0, ratingType: 'system_estimate',
    source: `${REFERENCE_NOTE}${tradition ? ` Tradición: ${tradition}.` : ''}`
  };
}

const VEGAN_PROTEINS = [
  { id: 'garbanzos', label: 'garbanzos', name: 'garbanzos cocidos', amount: 320, unit: 'g', category: 'legumbres', kcal: 210, protein: 11, carbs: 31, fat: 3, fiber: 9, cost: 1.35, prep: 'Enjuaga y escurre los garbanzos; sécalos y saltéalos 4 minutos para que tomen color.' },
  { id: 'lentejas', label: 'lentejas', name: 'lentejas cocidas', amount: 340, unit: 'g', category: 'legumbres', kcal: 195, protein: 14, carbs: 31, fat: 1, fiber: 11, cost: 1.25, prep: 'Enjuaga y escurre las lentejas; caliéntalas 3 minutos en una sartén para eliminar el exceso de humedad.' },
  { id: 'alubias-negras', label: 'alubias negras', name: 'alubias negras cocidas', amount: 340, unit: 'g', category: 'legumbres', kcal: 205, protein: 13, carbs: 33, fat: 1, fiber: 12, cost: 1.4, prep: 'Enjuaga y escurre las alubias negras; saltéalas 4 minutos, moviéndolas con cuidado para que no se rompan.' },
  { id: 'alubias-blancas', label: 'alubias blancas', name: 'alubias blancas cocidas', amount: 340, unit: 'g', category: 'legumbres', kcal: 215, protein: 14, carbs: 34, fat: 1, fiber: 11, cost: 1.35, prep: 'Enjuaga y escurre las alubias blancas; saltéalas 3 minutos hasta que estén calientes y ligeramente doradas.' },
  { id: 'tofu', label: 'tofu', name: 'tofu firme', amount: 320, unit: 'g', category: 'refrigerados', kcal: 230, protein: 25, carbs: 5, fat: 13, fiber: 2, cost: 2.5, traits: ['soy'], allergens: ['soja'], prep: 'Escurre y seca el tofu, córtalo en dados de 2 cm y dóralo 7–8 minutos, girándolo para hacer varias caras.' },
  { id: 'tempeh', label: 'tempeh', name: 'tempeh', amount: 260, unit: 'g', category: 'refrigerados', kcal: 255, protein: 25, carbs: 10, fat: 14, fiber: 7, cost: 3.2, traits: ['soy'], allergens: ['soja'], prep: 'Corta el tempeh en tiras finas y dóralo 5–6 minutos en una sartén con unas gotas de aceite.' },
  { id: 'edamame', label: 'edamame', name: 'edamame desgranado', amount: 300, unit: 'g', category: 'congelados', kcal: 185, protein: 18, carbs: 14, fat: 8, fiber: 8, cost: 2.8, traits: ['soy'], allergens: ['soja'], prep: 'Cuece el edamame en agua hirviendo 4 minutos, escúrrelo bien y saltéalo 2 minutos.' },
  { id: 'guisantes', label: 'guisantes', name: 'guisantes', amount: 340, unit: 'g', category: 'congelados', kcal: 150, protein: 10, carbs: 24, fat: 1, fiber: 9, cost: 1.25, prep: 'Cuece los guisantes 4 minutos en agua hirviendo, escúrrelos y resérvalos sin enfriar.' },
  { id: 'soja-texturizada', label: 'soja texturizada', name: 'soja texturizada hidratada', amount: 300, unit: 'g', category: 'legumbres', kcal: 205, protein: 28, carbs: 18, fat: 4, fiber: 10, cost: 1.8, traits: ['soy'], allergens: ['soja'], prep: 'Escurre y presiona la soja texturizada ya hidratada; saltéala 6 minutos hasta que pierda humedad y se dore.' }
];

const VEGETABLES = [
  { id: 'brocoli', name: 'brócoli', amount: 280, kcal: 48, fiber: 4, cost: 1.3, prep: 'Separa el brócoli en ramilletes pequeños y corta el tallo tierno en láminas.' },
  { id: 'calabacin', name: 'calabacín', amount: 300, kcal: 30, fiber: 2, cost: 1.05, prep: 'Lava el calabacín y córtalo en medias lunas de medio centímetro.' },
  { id: 'berenjena', name: 'berenjena', amount: 300, kcal: 38, fiber: 4, cost: 1.15, prep: 'Corta la berenjena en dados de 2 cm y sálala ligeramente.' },
  { id: 'pimiento-rojo', name: 'pimiento rojo', amount: 260, kcal: 40, fiber: 3, cost: 1.35, prep: 'Retira el pedúnculo y las semillas del pimiento rojo y córtalo en tiras finas.' },
  { id: 'espinacas', name: 'espinacas', amount: 200, kcal: 24, fiber: 3, cost: 1.25, prep: 'Lava y seca las espinacas; retira los tallos más gruesos.' },
  { id: 'champinones', name: 'champiñones', amount: 280, kcal: 31, fiber: 2, cost: 1.45, prep: 'Limpia los champiñones y córtalos en cuartos o láminas gruesas.' },
  { id: 'coliflor', name: 'coliflor', amount: 300, kcal: 38, fiber: 4, cost: 1.25, prep: 'Separa la coliflor en ramilletes pequeños y enjuágalos.' },
  { id: 'judias-verdes', name: 'judías verdes', amount: 300, kcal: 47, fiber: 5, cost: 1.4, prep: 'Retira las puntas de las judías verdes y córtalas en tramos de 4 cm.' },
  { id: 'zanahoria', name: 'zanahoria', amount: 280, kcal: 58, fiber: 4, cost: 0.75, prep: 'Pela la zanahoria y córtala en medias lunas finas para que se cocine de manera uniforme.' },
  { id: 'calabaza', name: 'calabaza', amount: 320, kcal: 52, fiber: 3, cost: 1.0, prep: 'Pela la calabaza, retira las semillas y córtala en dados de 2 cm.' }
];

const style = (config) => config;
const VEGAN_STYLES = [
  style({ id: 'mediterraneo', title: 'Bowl mediterráneo con quinoa', tradition: 'mediterránea', emoji: '🥗', time: 28, base: ingredient('quinoa', 150, 'g', 'cereales'), extras: [ingredient('tomate triturado', 180, 'g', 'conservas'), ingredient('limón', 1, 'unidad', 'frutas'), ingredient('orégano', 3, 'g', 'condimentos')], macros: { kcal: 260, protein: 7, carbs: 45, fat: 6, fiber: 4 }, cost: 1.8, traits: [], allergens: [], steps: (main, veg) => ['Enjuaga la quinoa y cuécela con el doble de agua y una pizca de sal durante 12–15 minutos; déjala reposar tapada 5 minutos.', main.prep, `${veg.prep} Cocina ${veg.name} con el tomate triturado y el orégano durante 7–10 minutos, hasta que esté tierno; incorpora ${main.name} al final.`, `Reparte la quinoa, añade la mezcla caliente y termina con el zumo de limón.`] }),
  style({ id: 'indio', title: 'Curry indio con arroz basmati', tradition: 'india', emoji: '🍛', time: 30, base: ingredient('arroz basmati', 160, 'g', 'cereales'), extras: [ingredient('leche de coco', 240, 'ml', 'conservas'), ingredient('tomate triturado', 160, 'g', 'conservas'), ingredient('curry en polvo', 8, 'g', 'condimentos')], macros: { kcal: 295, protein: 5, carbs: 48, fat: 10, fiber: 2 }, cost: 2.05, traits: [], allergens: [], steps: (main, veg) => ['Lava el arroz basmati hasta que el agua salga clara y cuécelo tapado a fuego suave 12 minutos; apágalo y déjalo reposar 5 minutos.', main.prep, `${veg.prep} Tuesta el curry 30 segundos, añade el tomate, la leche de coco y ${veg.name}; cocina 8–12 minutos según su dureza.`, `Incorpora ${main.name}, hierve suavemente 3 minutos, corrige de sal y sirve el curry con el arroz.`] }),
  style({ id: 'mexicano', title: 'Tacos mexicanos', tradition: 'mexicana', emoji: '🌮', time: 24, base: ingredient('tortillas de maíz', 6, 'unidad', 'cereales'), extras: [ingredient('tomate', 180, 'g', 'verduras'), ingredient('lima', 1, 'unidad', 'frutas'), ingredient('comino molido', 5, 'g', 'condimentos')], macros: { kcal: 245, protein: 5, carbs: 45, fat: 5, fiber: 5 }, cost: 1.75, traits: [], allergens: [], steps: (main, veg) => [main.prep, `${veg.prep} Saltéalo con el comino 7–10 minutos y añade ${main.name} para que se impregne del condimento.`, 'Corta el tomate en dados, mézclalo con la mitad del zumo de lima y una pizca de sal.', `Calienta las tortillas 20 segundos por cada lado, rellénalas con ${main.name} y ${veg.name}, y termina con el tomate y la lima restante.`] }),
  style({ id: 'tailandes', title: 'Fideos tailandeses al coco', tradition: 'tailandesa', emoji: '🍜', time: 26, base: ingredient('fideos de arroz', 160, 'g', 'cereales'), extras: [ingredient('leche de coco', 220, 'ml', 'conservas'), ingredient('lima', 1, 'unidad', 'frutas'), ingredient('pasta de curry rojo vegana', 18, 'g', 'condimentos')], macros: { kcal: 285, protein: 4, carbs: 48, fat: 9, fiber: 2 }, cost: 2.3, traits: [], allergens: [], steps: (main, veg) => ['Remoja o cuece los fideos de arroz siguiendo el envase; escúrrelos un minuto antes de que estén completamente tiernos.', main.prep, `${veg.prep} Cocina la pasta de curry 30 segundos, vierte la leche de coco y añade ${veg.name}; hierve suavemente 6–10 minutos.`, `Agrega ${main.name} y los fideos, cocina 2 minutos para terminar la cocción y sirve con el zumo de lima.`] }),
  style({ id: 'japones', title: 'Donburi japonés', tradition: 'japonesa', emoji: '🍚', time: 27, base: ingredient('arroz de grano corto', 160, 'g', 'cereales'), extras: [ingredient('salsa de soja', 24, 'ml', 'condimentos'), ingredient('vinagre de arroz', 18, 'ml', 'condimentos'), ingredient('semillas de sésamo', 12, 'g', 'semillas')], macros: { kcal: 275, protein: 6, carbs: 52, fat: 5, fiber: 2 }, cost: 2.0, traits: ['soy', 'sesame'], allergens: ['soja', 'sésamo'], steps: (main, veg) => ['Lava el arroz de grano corto, cuécelo tapado con 1,2 partes de agua durante 12 minutos y déjalo reposar 10 minutos sin destapar.', main.prep, `${veg.prep} Saltea ${veg.name} 6–10 minutos; añade la salsa de soja, el vinagre de arroz y ${main.name}, y cocina 2 minutos más.`, 'Sirve la mezcla sobre el arroz y reparte las semillas de sésamo por encima.'] }),
  style({ id: 'magrebi', title: 'Cuscús magrebí', tradition: 'magrebí', emoji: '🥘', time: 27, base: ingredient('cuscús integral', 160, 'g', 'cereales'), extras: [ingredient('tomate triturado', 180, 'g', 'conservas'), ingredient('limón', 1, 'unidad', 'frutas'), ingredient('ras el hanout', 7, 'g', 'condimentos')], macros: { kcal: 260, protein: 8, carbs: 48, fat: 4, fiber: 6 }, cost: 1.8, traits: ['gluten'], allergens: ['gluten'], steps: (main, veg) => ['Pon el cuscús integral en un bol con el mismo volumen de agua hirviendo y sal; tapa 7 minutos y suelta los granos con un tenedor.', main.prep, `${veg.prep} Cocina el tomate con el ras el hanout 2 minutos, añade ${veg.name} y un poco de agua, y guisa 8–12 minutos.`, `Incorpora ${main.name}, calienta 3 minutos y sirve sobre el cuscús con ralladura y zumo de limón.`] }),
  style({ id: 'italiano', title: 'Pasta italiana rústica', tradition: 'italiana', emoji: '🍝', time: 29, base: ingredient('pasta integral', 180, 'g', 'cereales'), extras: [ingredient('tomate triturado', 240, 'g', 'conservas'), ingredient('ajo', 2, 'unidad', 'verduras'), ingredient('albahaca', 8, 'g', 'condimentos')], macros: { kcal: 285, protein: 10, carbs: 52, fat: 4, fiber: 7 }, cost: 1.9, traits: ['gluten'], allergens: ['gluten'], steps: (main, veg) => ['Cuece la pasta integral en agua con sal hasta que quede al dente; reserva 120 ml del agua y escurre.', main.prep, `${veg.prep} Sofríe el ajo picado 30 segundos, añade el tomate y ${veg.name}, y cocina 8–12 minutos hasta que la verdura esté tierna.`, `Incorpora ${main.name}, la pasta y parte del agua reservada; mezcla 2 minutos y termina con la albahaca.`] }),
  style({ id: 'espanol', title: 'Cazuela española de patata', tradition: 'española', emoji: '🥔', time: 34, base: ingredient('patatas', 440, 'g', 'verduras'), extras: [ingredient('cebolla', 120, 'g', 'verduras'), ingredient('ajo', 2, 'unidad', 'verduras'), ingredient('pimentón ahumado', 6, 'g', 'condimentos')], macros: { kcal: 250, protein: 6, carbs: 47, fat: 5, fiber: 6 }, cost: 1.4, traits: [], allergens: [], steps: (main, veg) => ['Pela las patatas, córtalas en dados de 2 cm y cuécelas 8 minutos en agua con sal; escúrrelas cuando aún estén firmes.', main.prep, `${veg.prep} Sofríe la cebolla y el ajo 5 minutos, añade ${veg.name} y cocina 6–10 minutos; aparta del fuego para incorporar el pimentón sin quemarlo.`, `Añade las patatas y ${main.name}, saltea todo 4 minutos y sirve cuando la patata esté dorada y la mezcla bien caliente.`] }),
  style({ id: 'caribeno', title: 'Arroz caribeño al coco', tradition: 'caribeña', emoji: '🥥', time: 31, base: ingredient('arroz integral', 160, 'g', 'cereales'), extras: [ingredient('leche de coco', 180, 'ml', 'conservas'), ingredient('lima', 1, 'unidad', 'frutas'), ingredient('pimienta de Jamaica', 3, 'g', 'condimentos')], macros: { kcal: 305, protein: 5, carbs: 50, fat: 11, fiber: 3 }, cost: 2.0, traits: [], allergens: [], steps: (main, veg) => ['Cuece el arroz integral con la leche de coco, 180 ml de agua y una pizca de sal hasta que esté tierno; déjalo reposar tapado 5 minutos.', main.prep, `${veg.prep} Saltéalo 7–11 minutos con la pimienta de Jamaica; incorpora ${main.name} y cocina 2 minutos más.`, 'Sirve la mezcla sobre el arroz al coco y termina con el zumo y la ralladura de lima.'] }),
  style({ id: 'andino', title: 'Sopa andina de quinoa', tradition: 'andina', emoji: '🍲', time: 32, base: ingredient('quinoa', 130, 'g', 'cereales'), extras: [ingredient('tomate', 180, 'g', 'verduras'), ingredient('caldo vegetal', 650, 'ml', 'conservas'), ingredient('cilantro', 10, 'g', 'condimentos')], macros: { kcal: 225, protein: 7, carbs: 39, fat: 4, fiber: 4 }, cost: 2.0, traits: [], allergens: [], steps: (main, veg) => ['Enjuaga muy bien la quinoa. Corta el tomate en dados y caliéntalo 3 minutos en una olla con unas gotas de aceite.', main.prep, `${veg.prep} Añade a la olla la quinoa, ${veg.name} y el caldo; cuece a fuego suave 14–18 minutos, hasta que la quinoa se abra.`, `Incorpora ${main.name}, cocina 3 minutos más y sirve la sopa con el cilantro picado.`] }),
  style({ id: 'levantino', title: 'Ensalada tibia levantina', tradition: 'levantina', emoji: '🥙', time: 27, base: ingredient('bulgur', 150, 'g', 'cereales'), extras: [ingredient('tahini', 35, 'g', 'condimentos'), ingredient('limón', 1, 'unidad', 'frutas'), ingredient('comino molido', 4, 'g', 'condimentos')], macros: { kcal: 275, protein: 8, carbs: 42, fat: 9, fiber: 7 }, cost: 2.05, traits: ['gluten', 'sesame'], allergens: ['gluten', 'sésamo'], steps: (main, veg) => ['Cuece el bulgur en el doble de agua con sal durante 10–12 minutos; escúrrelo si hace falta y déjalo templar.', main.prep, `${veg.prep} Saltéalo con el comino durante 7–11 minutos y mezcla al final con ${main.name}.`, 'Bate el tahini con el zumo de limón y dos cucharadas de agua; sirve el bulgur con la mezcla tibia y vierte la salsa por encima.'] }),
  style({ id: 'etiope', title: 'Guiso etíope con mijo', tradition: 'etíope', emoji: '🥣', time: 35, base: ingredient('mijo', 150, 'g', 'cereales'), extras: [ingredient('tomate triturado', 220, 'g', 'conservas'), ingredient('cebolla', 120, 'g', 'verduras'), ingredient('berbere', 6, 'g', 'condimentos')], macros: { kcal: 270, protein: 7, carbs: 45, fat: 7, fiber: 5 }, cost: 1.9, traits: [], allergens: [], steps: (main, veg) => ['Enjuaga el mijo y cuécelo con 2,5 partes de agua y sal durante 18 minutos; déjalo reposar tapado.', main.prep, `${veg.prep} Sofríe la cebolla 6 minutos, añade el berbere y el tomate, incorpora ${veg.name} y guisa 9–13 minutos.`, `Agrega ${main.name}, cocina 3 minutos más y sirve el guiso sobre el mijo suelto.`] })
];

function veganSavoryRecipes() {
  const recipes = [];
  for (const style of VEGAN_STYLES) for (const main of VEGAN_PROTEINS) for (const veg of VEGETABLES) {
    const traits = [...(style.traits || []), ...(main.traits || [])];
    const allergens = [...(style.allergens || []), ...(main.allergens || [])];
    recipes.push(recipe({
      id: `lib-v-${style.id}-${main.id}-${veg.id}`,
      name: `${style.title} de ${main.label} y ${veg.name}`,
      emoji: style.emoji, mealTypes: ['lunch', 'dinner'], totalTime: style.time, prepTime: 8,
      nutrition: { kcal: style.macros.kcal + main.kcal + veg.kcal / 2, protein: style.macros.protein + main.protein + 2, carbs: style.macros.carbs + main.carbs + 4, fat: style.macros.fat + main.fat, fiber: style.macros.fiber + main.fiber + veg.fiber / 2 },
      estimatedCost: style.cost + main.cost + veg.cost,
      ingredients: [ingredient(main.name, main.amount, main.unit, main.category), style.base, ingredient(veg.name, veg.amount, 'g', 'verduras'), ...style.extras],
      description: `Una combinación de ${main.label}, ${veg.name} y ${style.base.name} con perfil ${style.tradition}; cantidades calculadas para dos raciones.`,
      steps: style.steps(main, veg), traits, allergens, tags: ['vegana', style.tradition, 'sin huevo', 'receta internacional'], tradition: style.tradition
    }));
  }
  return recipes;
}

const FRUITS = [
  { id: 'platano', name: 'plátano', amount: 1, unit: 'unidad', kcal: 55, cost: 0.45, prep: 'Pela el plátano y córtalo en rodajas.' },
  { id: 'manzana', name: 'manzana', amount: 1, unit: 'unidad', kcal: 48, cost: 0.5, prep: 'Lava la manzana, retira el corazón y córtala en dados pequeños.' },
  { id: 'pera', name: 'pera', amount: 1, unit: 'unidad', kcal: 52, cost: 0.55, prep: 'Lava la pera, retira el corazón y córtala en láminas finas.' },
  { id: 'arandanos', name: 'arándanos', amount: 100, unit: 'g', kcal: 29, cost: 1.35, prep: 'Lava los arándanos con suavidad y sécalos bien.' },
  { id: 'fresas', name: 'fresas', amount: 140, unit: 'g', kcal: 24, cost: 1.2, prep: 'Lava las fresas, retira las hojas y córtalas en cuartos.' },
  { id: 'mango', name: 'mango', amount: 180, unit: 'g', kcal: 54, cost: 1.1, prep: 'Pela el mango y corta la pulpa en dados, separándola del hueso.' }
];

const TOPPINGS = [
  { id: 'nueces', name: 'nueces', amount: 20, traits: ['nuts'], allergens: ['frutos secos'], kcal: 65, protein: 1.5, fat: 6.5, cost: 0.45, prep: 'Pica las nueces de forma gruesa.' },
  { id: 'almendras', name: 'almendras', amount: 20, traits: ['nuts'], allergens: ['frutos secos'], kcal: 58, protein: 2, fat: 5, cost: 0.4, prep: 'Corta las almendras en láminas o pícalas.' },
  { id: 'pepitas', name: 'semillas de calabaza', amount: 22, traits: [], allergens: [], kcal: 62, protein: 3, fat: 5, cost: 0.35, prep: 'Tuesta las semillas de calabaza 2 minutos en una sartén seca.' },
  { id: 'girasol', name: 'semillas de girasol', amount: 22, traits: [], allergens: [], kcal: 64, protein: 2, fat: 5.5, cost: 0.25, prep: 'Tuesta las semillas de girasol 2 minutos en una sartén seca.' }
];

const BREAKFAST_BASES = [
  { id: 'avena', title: 'Avena cremosa', emoji: '🥣', mealTypes: ['breakfast'], time: 10, base: [ingredient('avena', 60, 'g', 'cereales'), ingredient('leche de soja', 260, 'ml', 'bebidas')], traits: ['soy'], allergens: ['soja'], kcal: 280, protein: 14, carbs: 42, fat: 7, fiber: 7, cost: 0.75, steps: (fruit, topping) => [fruit.prep, `Pon la avena y la leche de soja en un cazo; añade la mitad de ${fruit.name} y cocina 5 minutos removiendo, hasta que quede cremosa.`, topping.prep, `Sirve la avena con el resto de ${fruit.name} y reparte ${topping.name} por encima.`] },
  { id: 'chia', title: 'Pudin de chía', emoji: '🥄', mealTypes: ['breakfast', 'snack'], time: 10, base: [ingredient('semillas de chía', 42, 'g', 'semillas'), ingredient('leche vegetal', 280, 'ml', 'bebidas')], traits: [], allergens: [], kcal: 245, protein: 9, carbs: 22, fat: 13, fiber: 12, cost: 0.95, steps: (fruit, topping) => [`Mezcla las semillas de chía con la leche vegetal; remueve de nuevo a los 5 minutos para romper los grumos.`, 'Tapa el recipiente y déjalo en la nevera al menos 4 horas, preferiblemente durante la noche.', fruit.prep + ' ' + topping.prep, `Remueve el pudin, reparte ${fruit.name} y ${topping.name} por encima y sirve frío.`] },
  { id: 'yogur-soja', title: 'Bol de yogur de soja', emoji: '🫐', mealTypes: ['breakfast', 'snack'], time: 6, base: [ingredient('yogur de soja', 220, 'g', 'refrigerados'), ingredient('avena', 35, 'g', 'cereales')], traits: ['soy'], allergens: ['soja'], kcal: 235, protein: 12, carbs: 31, fat: 7, fiber: 5, cost: 1.1, steps: (fruit, topping) => [fruit.prep, topping.prep, 'Remueve el yogur de soja hasta que quede cremoso y pásalo a un bol; añade la avena.', `Coloca ${fruit.name} y ${topping.name} encima justo antes de comer para conservar las texturas.`] },
  { id: 'tostada', title: 'Tostada integral', emoji: '🍞', mealTypes: ['breakfast', 'snack'], time: 8, base: [ingredient('pan integral', 80, 'g', 'cereales'), ingredient('crema de cacahuete', 28, 'g', 'frutos secos')], traits: ['gluten', 'nuts'], allergens: ['gluten', 'cacahuete'], kcal: 310, protein: 12, carbs: 39, fat: 13, fiber: 7, cost: 0.9, steps: (fruit, topping) => ['Tuesta el pan integral 2–3 minutos, hasta que quede dorado por fuera.', fruit.prep, 'Remueve la crema de cacahuete para integrar su aceite natural y extiéndela sobre el pan aún tibio.', `${topping.prep} Reparte ${fruit.name} y ${topping.name} sobre la tostada y sirve.`] },
  { id: 'batido', title: 'Batido de avena', emoji: '🥤', mealTypes: ['breakfast', 'snack'], time: 5, base: [ingredient('leche de soja', 300, 'ml', 'bebidas'), ingredient('avena', 35, 'g', 'cereales')], traits: ['soy'], allergens: ['soja'], kcal: 250, protein: 14, carbs: 36, fat: 7, fiber: 5, cost: 0.85, equipment: ['blender'], steps: (fruit, topping) => [fruit.prep, `${topping.prep} Pon ${fruit.name}, ${topping.name}, la avena y la leche de soja en la batidora.`, 'Tritura 45–60 segundos, hasta que la avena y las semillas o frutos secos queden finos.', 'Deja reposar 1 minuto; si está demasiado espeso, añade un poco de agua fría y vuelve a batir.'] }
];

function veganBreakfastRecipes() {
  const recipes = [];
  for (const base of BREAKFAST_BASES) for (const fruit of FRUITS) for (const topping of TOPPINGS) {
    recipes.push(recipe({
      id: `lib-v-des-${base.id}-${fruit.id}-${topping.id}`, name: `${base.title} con ${fruit.name} y ${topping.name}`, emoji: base.emoji,
      mealTypes: base.mealTypes, totalTime: base.time, prepTime: base.time, cookTime: base.id === 'avena' ? 5 : 0,
      nutrition: { kcal: base.kcal + fruit.kcal + topping.kcal, protein: base.protein + topping.protein, carbs: base.carbs + 12, fat: base.fat + topping.fat, fiber: base.fiber + 3 },
      estimatedCost: base.cost + fruit.cost + topping.cost,
      ingredients: [...base.base, ingredient(fruit.name, fruit.amount, fruit.unit, 'frutas'), ingredient(topping.name, topping.amount, 'g', topping.traits.includes('nuts') ? 'frutos secos' : 'semillas')],
      description: `Desayuno vegetal de ${base.title.toLowerCase()} con fruta y un acabado crujiente.`, steps: base.steps(fruit, topping),
      traits: [...base.traits, ...topping.traits], allergens: [...base.allergens, ...topping.allergens], equipment: base.equipment || [], tags: ['vegana', 'desayuno', 'sin huevo'], tradition: 'desayunos internacionales'
    }));
  }
  return recipes;
}

const SPECIAL_VEGETABLES = VEGETABLES.slice(0, 6);
const DAIRY_MAINS = [
  { id: 'queso-fresco', name: 'queso fresco', amount: 180, kcal: 180, protein: 20, fat: 9, cost: 1.9 },
  { id: 'ricotta', name: 'ricotta', amount: 180, kcal: 210, protein: 18, fat: 13, cost: 2.2 },
  { id: 'feta', name: 'queso feta', amount: 150, kcal: 200, protein: 16, fat: 15, cost: 2.4 },
  { id: 'yogur-griego', name: 'yogur griego natural', amount: 220, kcal: 170, protein: 20, fat: 7, cost: 1.7 }
];

const LACTO_STYLES = [
  { id: 'quinoa', title: 'Bowl lacto-vegetariano de quinoa', emoji: '🥗', base: ingredient('quinoa', 150, 'g', 'cereales'), time: 25, traits: [], allergens: [] },
  { id: 'pasta', title: 'Pasta cremosa lacto-vegetariana', emoji: '🍝', base: ingredient('pasta integral', 180, 'g', 'cereales'), time: 28, traits: ['gluten'], allergens: ['gluten'] },
  { id: 'patata', title: 'Patata rellena lacto-vegetariana', emoji: '🥔', base: ingredient('patatas', 440, 'g', 'verduras'), time: 35, traits: [], allergens: [], equipment: ['oven'] },
  { id: 'crema', title: 'Crema de verduras lacto-vegetariana', emoji: '🥣', base: ingredient('caldo vegetal', 550, 'ml', 'conservas'), time: 27, traits: [], allergens: [], equipment: ['blender'] }
];

function lactoSteps(styleId, main, veg) {
  if (styleId === 'quinoa') return ['Enjuaga la quinoa y cuécela con el doble de agua y sal durante 12–15 minutos; déjala reposar tapada 5 minutos.', veg.prep + ` Saltea ${veg.name} 7–10 minutos, hasta que esté tierno y dorado.`, `Desmenuza o remueve ${main.name} y sazónalo con pimienta y unas gotas de limón.`, `Sirve la quinoa con ${veg.name} y reparte ${main.name} por encima sin cocinarlo en exceso.`];
  if (styleId === 'pasta') return ['Cuece la pasta integral en agua con sal hasta que esté al dente; reserva 120 ml del agua y escurre.', veg.prep + ` Saltea ${veg.name} 7–10 minutos con una cucharadita de aceite.`, `Mezcla ${main.name} con parte del agua reservada hasta obtener una salsa; caliéntala a fuego bajo sin dejar que hierva.`, `Incorpora la pasta y ${veg.name}, remueve 2 minutos y sirve cuando la salsa los cubra.`];
  if (styleId === 'patata') return ['Calienta el horno a 210 °C. Lava las patatas, pínchalas y hornéalas 25–30 minutos, hasta que un cuchillo entre con facilidad.', veg.prep + ` Saltea ${veg.name} 7–10 minutos y sazónalo.`, `Abre las patatas, retira parte de la pulpa y mézclala con ${main.name} y ${veg.name}.`, 'Rellena las patatas y hornéalas 5 minutos más, hasta que la superficie esté caliente y ligeramente dorada.'];
  return [veg.prep + ` Sofríe ${veg.name} 4 minutos en una olla.`, `Añade el caldo vegetal y cuece ${veg.name} 10–14 minutos, hasta que esté completamente tierno.`, `Tritura la crema hasta que quede lisa y añade la mitad de ${main.name}; calienta a fuego bajo sin hervir.`, `Sirve la crema y reparte el resto de ${main.name} por encima.`];
}

function lactoRecipes() {
  const result = [];
  for (const style of LACTO_STYLES) for (const main of DAIRY_MAINS) for (const veg of SPECIAL_VEGETABLES) result.push(recipe({
    id: `lib-lacto-${style.id}-${main.id}-${veg.id}`, name: `${style.title} con ${main.name} y ${veg.name}`, emoji: style.emoji, mealTypes: ['lunch', 'dinner'], totalTime: style.time,
    nutrition: { kcal: 330 + main.kcal, protein: 10 + main.protein, carbs: 48, fat: 7 + main.fat, fiber: 7 + veg.fiber / 2 }, estimatedCost: 2.0 + main.cost + veg.cost,
    ingredients: [style.base, ingredient(main.name, main.amount, 'g', 'refrigerados'), ingredient(veg.name, veg.amount, 'g', 'verduras'), ingredient('limón', 1, 'unidad', 'frutas')],
    description: `Receta lacto-vegetariana con ${main.name}, ${veg.name} y ${style.base.name}.`, steps: lactoSteps(style.id, main, veg), traits: ['dairy', ...(style.traits || [])], allergens: ['lácteos', ...(style.allergens || [])], equipment: style.equipment || [], tags: ['lacto-vegetariana', 'sin huevo', 'receta internacional'], tradition: 'lacto-vegetariana'
  }));
  return result;
}

const EGG_FLAVORS = [
  { id: 'mediterraneo', label: 'mediterránea', extra: ingredient('orégano', 4, 'g', 'condimentos') },
  { id: 'mexicano', label: 'mexicana', extra: ingredient('comino molido', 4, 'g', 'condimentos') },
  { id: 'indio', label: 'india', extra: ingredient('curry en polvo', 5, 'g', 'condimentos') },
  { id: 'japones', label: 'japonesa', extra: ingredient('salsa de soja', 18, 'ml', 'condimentos'), traits: ['soy'], allergens: ['soja'] }
];
const EGG_STYLES = [
  { id: 'tortilla', title: 'Tortilla', emoji: '🍳', base: ingredient('patatas', 360, 'g', 'verduras'), time: 30 },
  { id: 'revuelto', title: 'Revuelto', emoji: '🍳', base: ingredient('pan integral', 100, 'g', 'cereales'), time: 18, traits: ['gluten'], allergens: ['gluten'] },
  { id: 'arroz', title: 'Bol de arroz con huevo', emoji: '🍚', base: ingredient('arroz', 150, 'g', 'cereales'), time: 26 },
  { id: 'horno', title: 'Huevos al plato', emoji: '🥘', base: ingredient('tomate triturado', 320, 'g', 'conservas'), time: 24, equipment: ['oven'] }
];

function eggSteps(style, flavor, veg) {
  if (style.id === 'tortilla') return ['Pela las patatas, córtalas en dados pequeños y cocínalas tapadas con un poco de aceite y agua durante 12–15 minutos.', veg.prep + ` Añade ${veg.name} y ${flavor.extra.name}, y cocina 5–8 minutos más.`, 'Bate cuatro huevos con sal, incorpora las verduras y vierte la mezcla en una sartén antiadherente.', 'Cuaja 4 minutos por un lado, da la vuelta con un plato y cocina 3 minutos más, hasta que el huevo esté completamente cuajado.'];
  if (style.id === 'revuelto') return [veg.prep + ` Saltea ${veg.name} 7–10 minutos con ${flavor.extra.name}.`, 'Bate cuatro huevos con una pizca de sal y añádelos a la sartén a fuego medio-bajo.', 'Remueve con una espátula durante 2–3 minutos, hasta que no quede huevo líquido, y retira antes de que se reseque.', 'Tuesta el pan integral y sirve el revuelto encima o al lado.'];
  if (style.id === 'arroz') return ['Lava el arroz y cuécelo en agua con sal según el envase; déjalo reposar tapado 5 minutos.', veg.prep + ` Saltea ${veg.name} 7–10 minutos y condimenta con ${flavor.extra.name}.`, 'Cocina cuatro huevos en una sartén antiadherente hasta que la clara esté completamente cuajada.', 'Reparte el arroz y la verdura en dos boles y coloca dos huevos cocinados sobre cada uno.'];
  return ['Calienta el horno a 200 °C y reparte el tomate triturado entre dos fuentes pequeñas.', veg.prep + ` Cocina ${veg.name} 6–9 minutos con ${flavor.extra.name} y añádelo sobre el tomate.`, 'Haz dos huecos en cada fuente, casca un huevo en cada uno y sazona.', 'Hornea 8–12 minutos, hasta que las claras estén completamente cuajadas; sirve con cuidado de no quemarte con la fuente.'];
}

function ovoRecipes() {
  const result = [];
  for (const style of EGG_STYLES) for (const flavor of EGG_FLAVORS) for (const veg of SPECIAL_VEGETABLES) result.push(recipe({
    id: `lib-ovo-${style.id}-${flavor.id}-${veg.id}`, name: `${style.title} ${flavor.label} de ${veg.name}`, emoji: style.emoji, mealTypes: ['breakfast', 'lunch', 'dinner'], totalTime: style.time,
    nutrition: { kcal: 390 + veg.kcal / 2, protein: 25, carbs: style.id === 'revuelto' ? 39 : 48, fat: 17, fiber: 5 + veg.fiber / 2 }, estimatedCost: 2.7 + veg.cost,
    ingredients: [ingredient('huevos', 4, 'unidad', 'refrigerados'), style.base, ingredient(veg.name, veg.amount, 'g', 'verduras'), flavor.extra],
    description: `Preparación ovo-vegetariana ${flavor.label} con huevo, ${veg.name} y ${style.base.name}.`, steps: eggSteps(style, flavor, veg), traits: ['egg', ...(style.traits || []), ...(flavor.traits || [])], allergens: ['huevo', ...(style.allergens || []), ...(flavor.allergens || [])], equipment: style.equipment || [], tags: ['ovo-vegetariana', 'sin lácteos', flavor.label], tradition: flavor.label
  }));
  return result;
}

const CHEESES = [
  { id: 'mozzarella', name: 'mozzarella', amount: 150, kcal: 210, protein: 18, fat: 14, cost: 2.0 },
  { id: 'feta', name: 'queso feta', amount: 140, kcal: 195, protein: 15, fat: 14, cost: 2.3 },
  { id: 'manchego', name: 'queso manchego', amount: 110, kcal: 225, protein: 19, fat: 17, cost: 2.6 },
  { id: 'cabra', name: 'queso de cabra', amount: 130, kcal: 205, protein: 16, fat: 15, cost: 2.5 }
];
const VEGETARIAN_STYLES = [
  { id: 'frittata', title: 'Frittata', emoji: '🍳', base: ingredient('patatas', 300, 'g', 'verduras'), time: 30, equipment: ['oven'] },
  { id: 'quiche', title: 'Quiche', emoji: '🥧', base: ingredient('masa integral para quiche', 1, 'paquete', 'cereales'), time: 42, traits: ['gluten'], allergens: ['gluten'], equipment: ['oven'] },
  { id: 'gratin', title: 'Gratén', emoji: '🧀', base: ingredient('patatas', 420, 'g', 'verduras'), time: 38, equipment: ['oven'] },
  { id: 'crepe', title: 'Crepes salados', emoji: '🥞', base: ingredient('harina integral', 120, 'g', 'cereales'), time: 28, traits: ['gluten'], allergens: ['gluten'] }
];

function vegetarianSteps(style, cheese, veg) {
  if (style.id === 'frittata') return ['Calienta el horno a 190 °C. Cuece las patatas en dados 8 minutos y escúrrelas.', veg.prep + ` Saltea ${veg.name} 6–9 minutos y mézclalo con las patatas.`, `Bate cuatro huevos, incorpora ${cheese.name} desmenuzado y las verduras, y vierte todo en una sartén apta para horno.`, 'Cuaja 3 minutos al fuego y hornea 10–12 minutos, hasta que el centro esté firme y el huevo totalmente cocinado.'];
  if (style.id === 'quiche') return ['Calienta el horno a 190 °C, coloca la masa integral en un molde y pínchala con un tenedor.', veg.prep + ` Saltea ${veg.name} 7–10 minutos para eliminar humedad.`, `Bate cuatro huevos, mezcla con ${cheese.name} y ${veg.name}, y vierte el relleno sobre la masa.`, 'Hornea 25–30 minutos, hasta que el centro esté cuajado y los bordes dorados; deja reposar 5 minutos antes de cortar.'];
  if (style.id === 'gratin') return ['Calienta el horno a 200 °C. Corta las patatas en láminas finas y cuécelas 7 minutos; escúrrelas.', veg.prep + ` Cocina ${veg.name} 6–9 minutos en una sartén.`, `Alterna capas de patata y ${veg.name}, reparte ${cheese.name} y vierte por encima cuatro huevos batidos.`, 'Hornea 20–24 minutos, hasta que el huevo esté cuajado, la patata tierna y el queso dorado.'];
  return ['Bate la harina integral con dos huevos y 260 ml de agua hasta obtener una masa fluida; déjala reposar 10 minutos.', veg.prep + ` Saltea ${veg.name} 7–10 minutos y mézclalo con ${cheese.name}.`, 'Cocina porciones finas de masa 1–2 minutos por cada lado en una sartén antiadherente.', `Rellena los crepes con ${veg.name} y ${cheese.name}, dóblalos y caliéntalos 2 minutos antes de servir.`];
}

function vegetarianRecipes() {
  const result = [];
  for (const style of VEGETARIAN_STYLES) for (const cheese of CHEESES) for (const veg of SPECIAL_VEGETABLES) result.push(recipe({
    id: `lib-veg-${style.id}-${cheese.id}-${veg.id}`, name: `${style.title} de ${veg.name} y ${cheese.name}`, emoji: style.emoji, mealTypes: ['lunch', 'dinner'], totalTime: style.time,
    nutrition: { kcal: 420 + cheese.kcal, protein: 24 + cheese.protein, carbs: 42, fat: 18 + cheese.fat, fiber: 5 + veg.fiber / 2 }, estimatedCost: 3.0 + cheese.cost + veg.cost,
    ingredients: [ingredient('huevos', 4, 'unidad', 'refrigerados'), style.base, ingredient(cheese.name, cheese.amount, 'g', 'refrigerados'), ingredient(veg.name, veg.amount, 'g', 'verduras')],
    description: `Receta vegetariana con huevo, ${cheese.name}, ${veg.name} y ${style.base.name}.`, steps: vegetarianSteps(style, cheese, veg), traits: ['egg', 'dairy', ...(style.traits || [])], allergens: ['huevo', 'lácteos', ...(style.allergens || [])], equipment: style.equipment || [], tags: ['vegetariana', 'con huevo', 'con lácteos'], tradition: 'vegetariana internacional'
  }));
  return result;
}

const FISH_MAINS = [
  { id: 'salmon', name: 'salmón', amount: 320, kcal: 330, protein: 35, fat: 20, cost: 6.8, allergens: ['pescado'], prep: 'Retira posibles espinas del salmón, sécalo y córtalo en dos porciones.', done: 'opaco en el centro y se separe en lascas' },
  { id: 'merluza', name: 'merluza', amount: 340, kcal: 190, protein: 38, fat: 4, cost: 5.2, allergens: ['pescado'], prep: 'Seca la merluza, comprueba que no tenga espinas y córtala en dos porciones.', done: 'opaca y se separe en lascas sin estar seca' },
  { id: 'bacalao', name: 'bacalao desalado', amount: 340, kcal: 200, protein: 40, fat: 3, cost: 6.1, allergens: ['pescado'], prep: 'Seca el bacalao desalado, retira posibles espinas y córtalo en dos porciones.', done: 'opaco en el centro y se abra en lascas' },
  { id: 'langostinos', name: 'langostinos pelados', amount: 320, kcal: 190, protein: 39, fat: 2, cost: 6.4, allergens: ['crustáceos'], prep: 'Seca los langostinos pelados y retira el hilo intestinal si aún lo tienen.', done: 'rosados, opacos y firmes' }
];
const FISH_STYLES = [
  { id: 'horno', title: 'Bandeja mediterránea', emoji: '🐟', base: ingredient('patatas', 420, 'g', 'verduras'), extra: ingredient('limón', 1, 'unidad', 'frutas'), time: 34, equipment: ['oven'] },
  { id: 'arroz', title: 'Arroz marinero', emoji: '🥘', base: ingredient('arroz', 160, 'g', 'cereales'), extra: ingredient('caldo de pescado', 420, 'ml', 'conservas'), time: 32 },
  { id: 'tacos', title: 'Tacos costeros', emoji: '🌮', base: ingredient('tortillas de maíz', 6, 'unidad', 'cereales'), extra: ingredient('lima', 1, 'unidad', 'frutas'), time: 24 },
  { id: 'guiso', title: 'Guiso de tomate', emoji: '🍲', base: ingredient('tomate triturado', 320, 'g', 'conservas'), extra: ingredient('cuscús integral', 150, 'g', 'cereales'), time: 30, traits: ['gluten'], allergens: ['gluten'] }
];

function fishSteps(style, main, veg) {
  if (style.id === 'horno') return ['Calienta el horno a 210 °C. Corta las patatas en dados, mézclalas con aceite y sal, y hornéalas 15 minutos.', main.prep + ' ' + veg.prep, `Añade ${veg.name} y ${main.name} a la bandeja, sazona y rocía con limón.`, `Hornea 10–14 minutos más, ajustando al grosor, hasta que ${main.name} esté ${main.done}; sirve de inmediato.`];
  if (style.id === 'arroz') return [main.prep + ' ' + veg.prep, `Saltea ${veg.name} 6–9 minutos, añade el arroz y remueve 1 minuto.`, 'Vierte el caldo de pescado caliente y cocina el arroz a fuego medio según el tiempo del envase.', `Incorpora ${main.name} durante los últimos 5–8 minutos, según su tamaño, y cocina hasta que esté ${main.done}.`];
  if (style.id === 'tacos') return [main.prep + ` Sazona ${main.name} con sal y la mitad de la lima.`, veg.prep + ` Saltea ${veg.name} 6–9 minutos y resérvalo.`, `Cocina ${main.name} en la misma sartén el tiempo necesario hasta que esté ${main.done}; córtalo en trozos si hace falta.`, `Calienta las tortillas 20 segundos por lado y rellénalas con ${main.name}, ${veg.name} y el resto de la lima.`];
  return ['Prepara el cuscús integral con el mismo volumen de agua hirviendo y sal; tapa 7 minutos y suelta los granos.', main.prep + ' ' + veg.prep, `Cocina el tomate triturado con ${veg.name} durante 8–12 minutos, hasta que la verdura esté tierna.`, `Añade ${main.name} y cocina a fuego suave hasta que esté ${main.done}; sirve el guiso con el cuscús.`];
}

function pescetarianRecipes() {
  const result = [];
  for (const style of FISH_STYLES) for (const main of FISH_MAINS) for (const veg of SPECIAL_VEGETABLES) result.push(recipe({
    id: `lib-pesc-${style.id}-${main.id}-${veg.id}`, name: `${style.title} de ${main.name} y ${veg.name}`, emoji: style.emoji, mealTypes: ['lunch', 'dinner'], totalTime: style.time,
    nutrition: { kcal: 310 + main.kcal, protein: 8 + main.protein, carbs: 48, fat: 7 + main.fat, fiber: 5 + veg.fiber / 2 }, estimatedCost: 2.2 + main.cost + veg.cost,
    ingredients: [ingredient(main.name, main.amount, 'g', 'pescados'), style.base, ingredient(veg.name, veg.amount, 'g', 'verduras'), style.extra],
    description: `Plato pescetariano de ${main.name}, ${veg.name} y ${style.base.name}.`, steps: fishSteps(style, main, veg), traits: ['fish', ...(style.traits || [])], allergens: [...main.allergens, ...(style.allergens || [])], equipment: style.equipment || [], tags: ['pescetariana', 'alta proteína', 'sin huevo'], tradition: 'cocinas costeras internacionales'
  }));
  return result;
}

const MEAT_MAINS = [
  { id: 'pollo', name: 'pechuga de pollo', amount: 340, kcal: 280, protein: 52, fat: 6, cost: 4.2, prep: 'Seca la pechuga de pollo y córtala en tiras de tamaño uniforme.', done: 'totalmente cocinada y sin zonas rosadas en el centro' },
  { id: 'pavo', name: 'pechuga de pavo', amount: 340, kcal: 265, protein: 54, fat: 4, cost: 4.5, prep: 'Seca la pechuga de pavo y córtala en dados de 2 cm.', done: 'totalmente cocinada y sin zonas rosadas en el centro' },
  { id: 'ternera', name: 'ternera magra en tiras', amount: 320, kcal: 340, protein: 44, fat: 17, cost: 6.0, prep: 'Seca las tiras de ternera y sepáralas para que se doren sin amontonarse.', done: 'dorada por fuera y cocinada al punto deseado' },
  { id: 'cerdo', name: 'lomo de cerdo', amount: 340, kcal: 320, protein: 48, fat: 13, cost: 4.3, prep: 'Seca el lomo de cerdo y córtalo en medallones finos del mismo grosor.', done: 'cocinado en el centro y con los jugos claros' }
];
const MEAT_STYLES = [
  { id: 'bandeja', title: 'Bandeja mediterránea', emoji: '🍗', base: ingredient('patatas', 420, 'g', 'verduras'), extra: ingredient('limón', 1, 'unidad', 'frutas'), time: 38, equipment: ['oven'] },
  { id: 'wok', title: 'Wok asiático', emoji: '🥢', base: ingredient('arroz', 160, 'g', 'cereales'), extra: ingredient('salsa de soja', 24, 'ml', 'condimentos'), time: 28, traits: ['soy'], allergens: ['soja'] },
  { id: 'tacos', title: 'Tacos especiados', emoji: '🌮', base: ingredient('tortillas de maíz', 6, 'unidad', 'cereales'), extra: ingredient('comino molido', 5, 'g', 'condimentos'), time: 25 },
  { id: 'guiso', title: 'Guiso rústico', emoji: '🍲', base: ingredient('cuscús integral', 150, 'g', 'cereales'), extra: ingredient('tomate triturado', 300, 'g', 'conservas'), time: 34, traits: ['gluten'], allergens: ['gluten'] }
];

function meatSteps(style, main, veg) {
  if (style.id === 'bandeja') return ['Calienta el horno a 210 °C. Corta las patatas en dados, sazónalas y hornéalas 15 minutos.', main.prep + ' ' + veg.prep, `Añade ${veg.name} y ${main.name} a la bandeja, rocía con el zumo de limón y mezcla sin superponer la carne.`, `Hornea 12–18 minutos más, según el grosor, hasta que ${main.name} esté ${main.done}.`];
  if (style.id === 'wok') return ['Cuece el arroz en agua con sal según el envase y déjalo reposar tapado.', main.prep + ` Saltéala a fuego vivo hasta que esté dorada; retira ${main.name} a un plato.`, veg.prep + ` Saltea ${veg.name} 6–9 minutos y devuelve ${main.name} al wok.`, `Añade la salsa de soja y cocina 2–4 minutos más, hasta que ${main.name} esté ${main.done}; sirve con el arroz.`];
  if (style.id === 'tacos') return [main.prep + ` Mézclala con el comino y una pizca de sal.`, veg.prep + ` Saltea ${veg.name} 6–9 minutos y resérvalo.`, `Cocina ${main.name} en la misma sartén hasta que esté ${main.done}.`, `Calienta las tortillas 20 segundos por cada lado y rellénalas con ${main.name} y ${veg.name}.`];
  return ['Prepara el cuscús integral con el mismo volumen de agua hirviendo y sal; tapa 7 minutos y suelta los granos.', main.prep + ' ' + veg.prep, `Dora ${main.name}, añade el tomate triturado y ${veg.name}, y cocina a fuego suave 12–18 minutos.`, `Comprueba que ${main.name} esté ${main.done}, corrige de sal y sirve el guiso con el cuscús.`];
}

function omnivoreRecipes() {
  const result = [];
  for (const style of MEAT_STYLES) for (const main of MEAT_MAINS) for (const veg of SPECIAL_VEGETABLES) result.push(recipe({
    id: `lib-omni-${style.id}-${main.id}-${veg.id}`, name: `${style.title} de ${main.name} y ${veg.name}`, emoji: style.emoji, mealTypes: ['lunch', 'dinner'], totalTime: style.time,
    nutrition: { kcal: 320 + main.kcal, protein: 8 + main.protein, carbs: 48, fat: 7 + main.fat, fiber: 5 + veg.fiber / 2 }, estimatedCost: 2.1 + main.cost + veg.cost,
    ingredients: [ingredient(main.name, main.amount, 'g', 'carnes'), style.base, ingredient(veg.name, veg.amount, 'g', 'verduras'), style.extra],
    description: `Plato omnívoro de ${main.name}, ${veg.name} y ${style.base.name}.`, steps: meatSteps(style, main, veg), traits: ['meat', ...(style.traits || [])], allergens: [...(style.allergens || [])], equipment: style.equipment || [], tags: ['omnívora', 'alta proteína', 'sin huevo'], tradition: 'cocinas internacionales'
  }));
  return result;
}

const GENERATED_RECIPES = [
  ...veganSavoryRecipes(),
  ...veganBreakfastRecipes(),
  ...lactoRecipes(),
  ...ovoRecipes(),
  ...vegetarianRecipes(),
  ...pescetarianRecipes(),
  ...omnivoreRecipes()
];

export const RECIPE_LIBRARY = Object.freeze([...DEMO_RECIPES, ...GENERATED_RECIPES]);
export const BUILTIN_RECIPE_COUNT = RECIPE_LIBRARY.length;

export const DIET_CATALOG_PROFILES = Object.freeze([
  { key: 'vegan', label: 'Vegana', diet: 'vegan', eatsEgg: false, eatsDairy: false },
  { key: 'lacto_vegetarian', label: 'Lacto-vegetariana', diet: 'lacto_vegetarian', eatsEgg: false, eatsDairy: true },
  { key: 'ovo_vegetarian', label: 'Ovo-vegetariana', diet: 'ovo_vegetarian', eatsEgg: true, eatsDairy: false },
  { key: 'vegetarian', label: 'Vegetariana', diet: 'vegetarian', eatsEgg: true, eatsDairy: true },
  { key: 'pescetarian', label: 'Pescetariana', diet: 'pescetarian', eatsEgg: true, eatsDairy: true },
  { key: 'flexitarian', label: 'Flexitariana', diet: 'flexitarian', eatsEgg: true, eatsDairy: true },
  { key: 'omnivore', label: 'Omnívora', diet: 'omnivore', eatsEgg: true, eatsDairy: true }
]);

export function catalogCounts(isCompatible) {
  return Object.fromEntries(DIET_CATALOG_PROFILES.map(profile => [profile.key, RECIPE_LIBRARY.filter(item => isCompatible(item, { ...profile, allergies: [], restrictions: [], dislikes: [], equipment: [] })).length]));
}
