import { DEMO_RECIPES, DEFAULT_PROFILE, DEMO_EXERCISE, createDemoPantry } from './demo-data.js';
import {
  DAY_LABELS, MEAL_LABELS, buildShoppingList, calculateBMI, calculateGoalProgress, classifyAdultBMI, consumeRecipe, generateWeek, getExpiryStatus,
  isRecipeCompatible, menuNutrition, normalizeFoodName, normalizeText, normalizeUnit,
  pantryCoverage, regenerateMeal, roundQuantity, sameFood, scaleIngredients, upsertBodyMeasurement, upsertPantryItem, validateRecipe
} from './nutrihome-core.js';
import { clearLocalState, loadLocalState, newestSnapshot, pullRemoteState, pushRemoteState, saveLocalState } from './storage.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clone = value => structuredClone(value);
const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
const number = value => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(Number(value) || 0);
const LOCATION_LABELS = { fridge: 'Nevera', freezer: 'Congelador', pantry: 'Despensa' };
const CATEGORY_EMOJI = { verduras: '🥬', frutas: '🍎', refrigerados: '❄️', congelados: '🧊', cereales: '🌾', legumbres: '🫘', conservas: '🥫', bebidas: '🥛', otros: '◌' };
const DIET_LABELS = { omnivore: 'Omnívora', flexitarian: 'Flexitariana', pescetarian: 'Pescetariana', vegetarian: 'Vegetariana', vegan: 'Vegana', lacto_vegetarian: 'Lacto-vegetariana', ovo_vegetarian: 'Ovo-vegetariana' };

let state;
let activeDay = Math.max(0, Math.min(6, (new Date().getDay() + 6) % 7));
let activeRecipeId = null;
let recipeServings = 1;
let saveTimer = null;
let simpleHandler = null;
let installPrompt = null;

function defaultBodyMetrics() {
  return { age: null, heightCm: null, currentWeightKg: null, currentMuscleKg: null, goalType: 'total', goalValueKg: null, history: [] };
}

function initialState() {
  const profile = clone(DEFAULT_PROFILE);
  const pantry = createDemoPantry();
  const recipes = clone(DEMO_RECIPES);
  const menu = generateWeek({ recipes, profile, pantry, exercise: DEMO_EXERCISE, mode: 'balanced' });
  return {
    version: 1, updatedAt: new Date().toISOString(), profile, pantry, recipes, menu,
    exercise: clone(DEMO_EXERCISE), favorites: [], ratings: {}, cookedHistory: [], dismissedRecipes: [],
    shopping: buildShoppingList(menu, recipes, pantry), manualShopping: [], generationMode: 'balanced', bodyMetrics: defaultBodyMetrics()
  };
}

function normalizeState(saved) {
  const fresh = initialState();
  if (!saved || saved.version !== 1) return fresh;
  const merged = { ...fresh, ...saved, profile: { ...fresh.profile, ...(saved.profile || {}) } };
  delete merged.profile.name;
  merged.recipes = Array.isArray(saved.recipes) && saved.recipes.length ? saved.recipes : fresh.recipes;
  merged.pantry = Array.isArray(saved.pantry) ? saved.pantry : fresh.pantry;
  merged.menu = Array.isArray(saved.menu) && saved.menu.length ? saved.menu : fresh.menu;
  merged.shopping = Array.isArray(saved.shopping) ? saved.shopping : buildShoppingList(merged.menu, merged.recipes, merged.pantry);
  merged.bodyMetrics = { ...fresh.bodyMetrics, ...(saved.bodyMetrics || {}) };
  merged.bodyMetrics.history = Array.isArray(saved.bodyMetrics?.history) ? saved.bodyMetrics.history.filter(item => item?.date && Number(item.weightKg) > 0).sort((a, b) => a.date.localeCompare(b.date)) : [];
  return merged;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function timeGreeting(date = new Date()) {
  return date.getHours() < 14 ? 'Buenos días' : 'Buenas tardes';
}

function weekDates() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function updateSyncBadge(status) {
  const badge = $('#sync-badge');
  badge.className = `sync-badge ${status === 'synced' || status === 'local' ? '' : status}`;
  badge.querySelector('span').textContent = ({ synced: 'Sincronizado', local: 'Guardado', pending: 'Pendiente', offline: 'Sin conexión' })[status] || 'Guardado';
  $('#sync-detail').textContent = status === 'synced' ? 'Tus cambios están sincronizados con tu sesión.' : status === 'offline' ? 'Estás trabajando sin conexión. Los cambios quedan guardados y se enviarán al volver.' : 'Tus cambios se guardan offline en este dispositivo; la sincronización se activa con una sesión compatible.';
}

function persist({ remote = true } = {}) {
  clearTimeout(saveTimer);
  updateSyncBadge(navigator.onLine ? 'pending' : 'offline');
  saveTimer = setTimeout(async () => {
    state = await saveLocalState(state);
    const status = remote ? await pushRemoteState(state) : 'local';
    updateSyncBadge(status);
  }, 220);
}

function navigate(viewName, updateHash = true) {
  $$('.view').forEach(view => view.classList.toggle('active', view.dataset.view === viewName));
  $$('.bottom-nav [data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === viewName));
  if (updateHash) history.replaceState(null, '', `#${viewName}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (viewName === 'recipes') renderRecipes();
  if (viewName === 'pantry') renderPantry();
  if (viewName === 'shopping') renderShopping();
  if (viewName === 'more') renderProfile();
}

function findRecipe(id) { return state.recipes.find(recipe => recipe.id === id); }
function dayEntries(day = activeDay) { return state.menu.filter(entry => entry.day === day); }

function renderWeek() {
  const dates = weekDates();
  const first = dates[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const last = dates[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  $('#week-range').textContent = `Del ${first} al ${last}`;
  $('#week-title').textContent = timeGreeting();
  const weekTotals = menuNutrition(state.menu, state.recipes);
  $('#week-cost').textContent = euro(weekTotals.cost);
  const budgetDifference = (state.profile.weeklyBudget || 0) - weekTotals.cost;
  $('#budget-status').textContent = budgetDifference >= 0 ? `${euro(budgetDifference)} bajo presupuesto` : `${euro(Math.abs(budgetDifference))} sobre presupuesto`;
  $('#budget-status').style.color = budgetDifference >= 0 ? '' : '#b84c3d';

  $('#day-tabs').innerHTML = dates.map((date, index) => `<button class="day-tab ${index === activeDay ? 'active' : ''}" type="button" role="tab" aria-selected="${index === activeDay}" data-day="${index}"><span>${DAY_LABELS[index].slice(0, 3)}</span><b>${date.getDate()}</b></button>`).join('');
  const entries = dayEntries();
  const totals = menuNutrition(entries, state.recipes);
  $('#day-calories').innerHTML = `${number(totals.kcal)} <small>/ ${number(state.profile.calorieTarget)} kcal</small>`;
  $('#day-progress').style.width = `${Math.min(100, totals.kcal / state.profile.calorieTarget * 100)}%`;
  $('#day-protein').textContent = `${number(totals.protein)} g`;
  $('#day-carbs').textContent = `${number(totals.carbs)} g`;
  $('#day-fat').textContent = `${number(totals.fat)} g`;
  const activity = state.exercise.find(item => item.day === activeDay);
  $('#exercise-note').hidden = !activity;
  if (activity) $('#exercise-note').textContent = `Actividad prevista: ${activity.type}, ${activity.duration} min (${activity.intensity === 'high' ? 'intensa' : activity.intensity === 'medium' ? 'moderada' : 'suave'}). El generador la pondera, sin convertirla en una recomendación médica.`;

  $('#meal-list').innerHTML = entries.map(entry => {
    const recipe = findRecipe(entry.recipeId);
    if (!recipe) return '';
    return `<article class="meal-card" data-recipe-card="${recipe.id}">
      <button class="meal-emoji" type="button" data-open-recipe="${recipe.id}" aria-label="Ver ${escapeHtml(recipe.name)}">${recipe.emoji || '🍽️'}</button>
      <div class="meal-copy"><span>${MEAL_LABELS[entry.mealType]}</span><button class="meal-title" type="button" data-open-recipe="${recipe.id}">${escapeHtml(recipe.name)}</button><p>${number(recipe.nutrition.kcal)} kcal · ${number(recipe.nutrition.protein)} g prot. · ${recipe.totalTime} min · ${euro(recipe.estimatedCost / recipe.servings * entry.servings)} est.</p></div>
      <div class="meal-controls"><button class="meal-action" type="button" data-regenerate="${entry.id}" aria-label="Regenerar ${MEAL_LABELS[entry.mealType]}">↻</button><button class="meal-action" type="button" data-move-meal="${entry.id}" aria-label="Mover o sustituir comida">⋯</button><button class="meal-action" type="button" data-lock="${entry.id}" aria-pressed="${entry.locked}" aria-label="${entry.locked ? 'Desbloquear' : 'Bloquear'} ${escapeHtml(recipe.name)}">${entry.locked ? '●' : '○'}</button></div>
    </article>`;
  }).join('');

  const currentEntry = entries.find(entry => entry.mealType === nextMealType()) || entries[1] || entries[0];
  const currentRecipe = currentEntry && findRecipe(currentEntry.recipeId);
  if (currentRecipe) {
    $('#today-pill').textContent = `HOY · ${DAY_LABELS[activeDay].toUpperCase()}`;
    $('#today-title').textContent = currentRecipe.name;
    const coverage = pantryCoverage(currentRecipe, state.pantry, currentEntry.servings);
    $('#today-reason').textContent = coverage.missing === 0 ? `Puedes cocinarla ahora · lista en ${currentRecipe.totalTime} min` : `${currentRecipe.totalTime} min · faltan ${coverage.missing} ${coverage.missing === 1 ? 'ingrediente' : 'ingredientes'}`;
    $('#today-macros').innerHTML = `<span><b>${number(currentRecipe.nutrition.kcal)}</b> kcal</span><span><b>${number(currentRecipe.nutrition.protein)} g</b> proteína</span><span><b>${euro(currentRecipe.estimatedCost / currentRecipe.servings)}</b> / ración est.</span>`;
    $('#today-emoji').textContent = currentRecipe.emoji || '🍽️';
    $('#open-today').dataset.openRecipe = currentRecipe.id;
  }
  const expiring = state.pantry.filter(item => ['soon', 'today'].includes(getExpiryStatus(item.expiry).key));
  $('#waste-copy').textContent = expiring.length ? `Conviene usar ${expiring.slice(0, 3).map(item => item.name).join(', ')}${expiring.length > 3 ? ' y más' : ''}.` : 'No hay productos con fecha próxima. Buen trabajo.';
}

function nextMealType() {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

function runGenerator(mode = 'balanced') {
  try {
    state.menu = generateWeek({ recipes: state.recipes, profile: state.profile, pantry: state.pantry, exercise: state.exercise, previousMenu: state.menu, mode });
    state.generationMode = mode;
    recalculateShopping();
    persist();
    renderAll();
    showToast(`Semana generada: ${({ balanced: 'equilibrada', pantry: 'aprovechando despensa', waste: 'priorizando caducidades', economic: 'económica', quick: 'rápida', protein: 'alta en proteína', surprise: 'sorpresa' })[mode] || mode}`);
  } catch (error) { showToast(error.message); }
}

function compatibleRecipes() { return state.recipes.filter(recipe => isRecipeCompatible(recipe, state.profile)); }

function renderRecipes() {
  const search = normalizeText($('#recipe-search').value);
  const meal = $('#filter-meal').value;
  const maxTime = Number($('#filter-time').value) || Infinity;
  const minProtein = Number($('#filter-protein').value) || 0;
  const diet = $('#filter-diet').value;
  const pantryOnly = $('#filter-pantry').checked;
  const recipes = compatibleRecipes().filter(recipe => {
    const haystack = normalizeText([recipe.name, recipe.description, ...recipe.tags, ...recipe.ingredients.map(item => item.name)].join(' '));
    const dietMatch = !diet || isRecipeCompatible(recipe, { diet, eatsEgg: true, eatsDairy: true, allergies: [], restrictions: [], dislikes: [], equipment: [] });
    return (!search || haystack.includes(search)) && (!meal || recipe.mealTypes.includes(meal)) && dietMatch && recipe.totalTime <= maxTime && recipe.nutrition.protein >= minProtein && (!pantryOnly || pantryCoverage(recipe, state.pantry, state.profile.people).missing === 0);
  }).sort((a, b) => Number(state.favorites.includes(b.id)) - Number(state.favorites.includes(a.id)) || b.rating - a.rating);
  $('#recipe-count').textContent = compatibleRecipes().length;
  $('#recipe-summary').textContent = recipes.length ? `${recipes.length} ${recipes.length === 1 ? 'resultado' : 'resultados'} · incompatibles con tu perfil ocultas` : 'No hay recetas que cumplan todos esos filtros.';
  $('#recipe-grid').innerHTML = recipes.map(recipe => {
    const coverage = pantryCoverage(recipe, state.pantry, state.profile.people);
    const userRating = state.ratings[recipe.id];
    const rating = userRating || recipe.rating;
    const ratingLabel = userRating ? 'tu valoración' : recipe.ratingType === 'real' ? `${recipe.ratingCount} valoraciones` : 'estimación del sistema';
    return `<article class="recipe-card" data-open-recipe="${recipe.id}" tabindex="0" role="button" aria-label="Ver receta ${escapeHtml(recipe.name)}"><div class="recipe-art"><span aria-hidden="true">${recipe.emoji || '🍽️'}</span><button class="favorite-btn ${state.favorites.includes(recipe.id) ? 'active' : ''}" type="button" data-favorite="${recipe.id}" aria-label="${state.favorites.includes(recipe.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${state.favorites.includes(recipe.id) ? '♥' : '♡'}</button></div><div class="recipe-card-body"><p class="eyebrow">${recipe.mealTypes.map(type => MEAL_LABELS[type]).join(' · ')}</p><h2>${escapeHtml(recipe.name)}</h2><div class="recipe-meta"><span><b>${recipe.totalTime} min</b></span><span>${number(recipe.nutrition.kcal)} kcal</span><span>${number(recipe.nutrition.protein)} g prot.</span></div><div class="recipe-tags"><span>${coverage.missing === 0 ? 'puedo cocinar' : `faltan ${coverage.missing}`}</span>${recipe.tags.slice(0, 2).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="recipe-rating">★ ${number(rating)} <small>· ${ratingLabel}</small></div></div></article>`;
  }).join('');
}

function showRecipe(id, servings) {
  const recipe = findRecipe(id);
  if (!recipe) return;
  activeRecipeId = id;
  recipeServings = Math.max(1, Number(servings) || recipe.servings);
  const scaled = scaleIngredients(recipe, recipeServings);
  const userRating = state.ratings[id] || 0;
  const coverage = pantryCoverage(recipe, state.pantry, recipeServings);
  $('#recipe-dialog-content').innerHTML = `<button class="close-btn" type="button" data-close-dialog="recipe-dialog" aria-label="Cerrar">×</button>
    <section class="recipe-detail-hero"><div><p class="eyebrow">${recipe.mealTypes.map(type => MEAL_LABELS[type]).join(' · ')}</p><h2 id="recipe-dialog-title">${escapeHtml(recipe.name)}</h2><p>${escapeHtml(recipe.description)}</p><div class="detail-actions"><button type="button" data-favorite="${id}">${state.favorites.includes(id) ? '♥ Favorita' : '♡ Guardar'}</button><button type="button" data-cook-recipe="${id}">✓ Receta preparada</button></div></div><div class="recipe-detail-emoji" aria-hidden="true">${recipe.emoji || '🍽️'}</div></section>
    <div class="detail-grid"><div><div class="nutrition-grid"><div><b>${number(recipe.nutrition.kcal)}</b><span>kcal</span></div><div><b>${number(recipe.nutrition.protein)} g</b><span>proteína</span></div><div><b>${number(recipe.nutrition.carbs)} g</b><span>carbos</span></div><div><b>${number(recipe.nutrition.fat)} g</b><span>grasas</span></div><div><b>${number(recipe.nutrition.fiber)} g</b><span>fibra</span></div><div><b>${euro(recipe.estimatedCost / recipe.servings)}</b><span>ración · est.</span></div></div><h3>Valoración</h3><div class="rating-control" aria-label="Valorar receta">${[1,2,3,4,5].map(value => `<button class="${value <= userRating ? 'active' : ''}" type="button" data-rate="${value}" aria-label="${value} estrellas">★</button>`).join('')}</div><small>${userRating ? `Tu valoración: ${userRating}/5` : recipe.ratingType === 'real' ? `Valoración pública: ${recipe.rating}/5 (${recipe.ratingCount})` : `Recomendación estimada: ${recipe.rating}/5. No es una valoración pública real.`}</small><h3>Información</h3><p>${recipe.totalTime} min · ${recipe.prepTime} min preparación · ${recipe.cookTime} min cocción</p><p>Alérgenos declarados: ${recipe.allergens.length ? recipe.allergens.join(', ') : 'ninguno en los datos de demostración'}.</p><p><small>Fuente: ${escapeHtml(recipe.source)}</small></p></div>
    <div><div class="serving-control"><h3>Ingredientes</h3><label><span class="sr-only">Raciones</span><input id="recipe-servings" type="number" min="1" max="24" value="${recipeServings}" /></label><span>raciones</span></div><p><small>${coverage.missing === 0 ? 'Tienes todo en casa.' : `Te faltan ${coverage.missing} ingredientes para estas raciones.`}</small></p><ul class="ingredient-list">${scaled.map(item => `<li><span>${escapeHtml(item.name)}</span><b>${number(item.amount)} ${item.unit}</b></li>`).join('')}</ul><h3>Pasos</h3><ol class="step-list">${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></div></div>`;
  const dialog = $('#recipe-dialog');
  if (!dialog.open) dialog.showModal();
}

function renderPantry() {
  const query = normalizeText($('#pantry-search').value);
  const location = $('#pantry-location').value;
  const visible = state.pantry.filter(item => (!query || normalizeText(item.name).includes(query)) && (!location || item.location === location)).sort((a, b) => {
    const ad = getExpiryStatus(a.expiry).days ?? 99999; const bd = getExpiryStatus(b.expiry).days ?? 99999; return ad - bd;
  });
  const low = state.pantry.filter(item => Number(item.minQuantity) > 0 && item.quantity <= item.minQuantity);
  const expiry = state.pantry.filter(item => ['soon', 'today'].includes(getExpiryStatus(item.expiry).key));
  $('#pantry-total').textContent = state.pantry.length;
  $('#low-stock-total').textContent = low.length;
  $('#expiry-total').textContent = expiry.length;
  $('#pantry-alerts').classList.toggle('show', low.length + expiry.length > 0);
  $('#pantry-alerts').innerHTML = `<span>${low.length ? `${low.length} ${low.length === 1 ? 'producto está' : 'productos están'} bajo el mínimo. ` : ''}${expiry.length ? `${expiry.length} conviene usar pronto.` : ''}</span>${low.length ? '<button type="button" data-add-low-stock>Añadir faltantes a compra</button>' : ''}`;
  $('#pantry-list').innerHTML = visible.length ? visible.map(item => {
    const status = getExpiryStatus(item.expiry);
    const isLow = Number(item.minQuantity) > 0 && item.quantity <= item.minQuantity;
    const fill = item.minQuantity > 0 ? Math.min(100, item.quantity / (item.minQuantity * 2) * 100) : 100;
    return `<article class="pantry-item"><div class="pantry-icon" aria-hidden="true">${CATEGORY_EMOJI[item.category] || '◌'}</div><div class="pantry-copy"><h2>${escapeHtml(item.name)}</h2><p>${LOCATION_LABELS[item.location] || item.location} · ${item.price ? `${euro(item.price)} registrado` : 'precio no registrado'} <span class="expiry-badge ${status.key}">${status.label}</span></p></div><div class="stock-bar ${isLow ? 'low' : ''}"><span>${number(item.quantity)} ${item.unit}</span><i style="width:${fill}%"></i></div><div class="quantity-controls"><button type="button" data-pantry-delta="-${pantryStep(item)}" data-pantry-id="${item.id}" aria-label="Reducir ${escapeHtml(item.name)}">−</button><button type="button" data-pantry-delta="${pantryStep(item)}" data-pantry-id="${item.id}" aria-label="Aumentar ${escapeHtml(item.name)}">＋</button><button class="row-menu" type="button" data-edit-pantry="${item.id}" aria-label="Editar ${escapeHtml(item.name)}">⋯</button></div></article>`;
  }).join('') : '<div class="empty-state"><span>⌕</span><h2>Sin resultados</h2><p>Prueba con otro nombre o ubicación.</p></div>';
}

function pantryStep(item) { return ['g', 'ml'].includes(normalizeUnit(item.unit)) ? 50 : 1; }

function recalculateShopping() {
  const generated = buildShoppingList(state.menu, state.recipes, state.pantry);
  const oldByKey = new Map(state.shopping.map(item => [`${normalizeFoodName(item.name)}|${item.unit}`, item]));
  state.shopping = generated.map(item => ({ ...item, checked: oldByKey.get(`${normalizeFoodName(item.name)}|${item.unit}`)?.checked || false }));
  for (const purchased of [...oldByKey.values()].filter(item => item.checked && item.inventoryTransfer)) {
    if (!state.shopping.some(item => item.id === purchased.id)) state.shopping.push(purchased);
  }
  for (const manual of state.manualShopping) if (!state.shopping.some(item => item.id === manual.id)) state.shopping.push(manual);
}

function renderShopping() {
  const items = state.shopping;
  const checked = items.filter(item => item.checked).length;
  $('#nav-count').textContent = items.filter(item => !item.checked).length;
  $('#shopping-progress-label').textContent = `${checked} de ${items.length}`;
  $('#shopping-progress').style.width = `${items.length ? checked / items.length * 100 : 100}%`;
  const discountedProducts = items.filter(item => (item.available || 0) > 0).length;
  $('#shopping-saving').textContent = discountedProducts > 0 ? `Hemos descontado existencias de ${discountedProducts} ${discountedProducts === 1 ? 'producto' : 'productos'}. Solo mostramos las cantidades que faltan.` : 'Esta lista contiene únicamente lo que falta para el menú.';
  $('#shopping-empty').hidden = items.length > 0;
  const groups = Map.groupBy ? Map.groupBy(items, item => item.category || 'otros') : items.reduce((map, item) => map.set(item.category || 'otros', [...(map.get(item.category || 'otros') || []), item]), new Map());
  $('#shopping-list').innerHTML = [...groups].map(([category, group]) => `<section class="shopping-group"><h2>${escapeHtml(category)}</h2>${group.map(item => `<article class="shopping-item ${item.checked ? 'checked' : ''}"><button class="shopping-check ${item.checked ? 'checked' : ''}" type="button" data-check-shopping="${item.id}" aria-label="${item.checked ? 'Desmarcar' : 'Marcar comprado'} ${escapeHtml(item.name)}">${item.checked ? '✓' : ''}</button><div class="shopping-copy"><b>${escapeHtml(item.name)}</b><small>${item.source === 'manual' ? 'Añadido manualmente' : `Menú: ${number(item.required)} ${item.unit} · en casa: ${number(item.available)} ${item.unit}`}</small></div><div><b>${number(item.quantity)} ${item.unit}</b><button class="row-menu" type="button" data-delete-shopping="${item.id}" aria-label="Eliminar ${escapeHtml(item.name)}">×</button></div></article>`).join('')}</section>`).join('');
}

function renderProfile() {
  const profile = state.profile;
  $('#profile-diet').textContent = `${DIET_LABELS[profile.diet] || profile.diet}${profile.eatsEgg === false ? ' · sin huevo' : ''}${profile.eatsDairy === false ? ' · sin lácteos' : ''}`;
  $('#profile-tags').innerHTML = [...profile.allergies, ...profile.dislikes.map(item => `evita ${item}`)].map(item => `<span>${escapeHtml(item)}</span>`).join('') || '<span>sin exclusiones adicionales</span>';
  $('#goal-calories').textContent = `${number(profile.calorieTarget)} kcal`;
  $('#goal-protein').textContent = `${number(profile.proteinTarget)} g`;
  $('#goal-budget').textContent = euro(profile.weeklyBudget);
  $('#exercise-list').innerHTML = state.exercise.length ? state.exercise.sort((a,b) => a.day-b.day).map(item => `<article class="exercise-card"><span>${DAY_LABELS[item.day]}</span><h3>${escapeHtml(item.type)}</h3><p>${item.duration} min · ${item.intensity === 'high' ? 'intensa' : item.intensity === 'medium' ? 'moderada' : 'suave'}${item.calories ? ` · ${item.calories} kcal estimadas` : ''}</p></article>`).join('') : '<p class="intro">Aún no hay actividad planificada.</p>';
  const week = menuNutrition(state.menu, state.recipes);
  const unique = new Set(state.menu.map(item => item.recipeId)).size;
  const usedPantry = state.pantry.filter(item => item.quantity > item.minQuantity).length;
  $('#stats-grid').innerHTML = `<article class="stat-card"><span>Media diaria</span><strong>${number(week.kcal / 7)}</strong><small>kcal</small></article><article class="stat-card"><span>Proteína media</span><strong>${number(week.protein / 7)} g</strong><small>al día</small></article><article class="stat-card"><span>Coste estimado</span><strong>${euro(week.cost)}</strong><small>semana</small></article><article class="stat-card"><span>Variedad</span><strong>${unique}</strong><small>recetas distintas</small></article><article class="stat-card"><span>Despensa útil</span><strong>${usedPantry}</strong><small>productos disponibles</small></article><article class="stat-card"><span>Cocinadas</span><strong>${state.cookedHistory.length}</strong><small>en el historial</small></article>`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMetricDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setMetricInput(form, name, value) {
  const input = form.elements[name];
  if (input && document.activeElement !== input) input.value = value ?? '';
}

function updateGoalFormCopy() {
  const form = $('#body-goal-form');
  const muscle = form.elements.goalType.value === 'muscle';
  $('#body-goal-label').textContent = muscle ? 'Masa muscular deseada' : 'Peso corporal deseado';
  form.elements.goalValueKg.min = muscle ? '5' : '25';
  form.elements.goalValueKg.max = muscle ? '200' : '400';
  $('#muscle-goal-note').hidden = !muscle;
}

function drawWeightChart() {
  const canvas = $('#weight-chart');
  const empty = $('#weight-chart-empty');
  const history = state.bodyMetrics.history;
  const hasChart = history.length >= 2;
  canvas.hidden = !hasChart;
  empty.hidden = hasChart;
  if (!hasChart) return;

  const width = Math.max(320, Math.floor(canvas.clientWidth || 720));
  const height = 230;
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  const padding = { left: 46, right: 18, top: 24, bottom: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = history.map(item => Number(item.weightKg));
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);
  const range = Math.max(2, max - min);
  const x = index => padding.left + (history.length === 1 ? chartWidth / 2 : index / (history.length - 1) * chartWidth);
  const y = value => padding.top + (max - value) / range * chartHeight;

  context.clearRect(0, 0, width, height);
  context.font = '11px system-ui, sans-serif';
  context.fillStyle = '#66756f';
  context.strokeStyle = '#e2e5df';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const value = max - range * index / 4;
    const lineY = padding.top + chartHeight * index / 4;
    context.beginPath(); context.moveTo(padding.left, lineY); context.lineTo(width - padding.right, lineY); context.stroke();
    context.fillText(`${number(value)} kg`, 2, lineY + 4);
  }

  context.strokeStyle = '#e97862';
  context.lineWidth = 3;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.beginPath();
  history.forEach((item, index) => index ? context.lineTo(x(index), y(item.weightKg)) : context.moveTo(x(index), y(item.weightKg)));
  context.stroke();
  history.forEach((item, index) => {
    context.beginPath(); context.arc(x(index), y(item.weightKg), 4.5, 0, Math.PI * 2); context.fillStyle = '#173f35'; context.fill();
  });
  context.fillStyle = '#66756f';
  const firstLabel = formatMetricDate(history[0].date).replace(/ de /g, ' ');
  const lastLabel = formatMetricDate(history.at(-1).date).replace(/ de /g, ' ');
  context.fillText(firstLabel, padding.left, height - 10);
  const lastWidth = context.measureText(lastLabel).width;
  context.fillText(lastLabel, width - padding.right - lastWidth, height - 10);
}

function renderBodyMetrics() {
  const metrics = state.bodyMetrics;
  const metricsForm = $('#body-metrics-form');
  setMetricInput(metricsForm, 'age', metrics.age);
  setMetricInput(metricsForm, 'heightCm', metrics.heightCm);
  setMetricInput(metricsForm, 'weightKg', metrics.currentWeightKg);
  setMetricInput(metricsForm, 'muscleKg', metrics.currentMuscleKg);

  const result = $('#bmi-result');
  if (metrics.age >= 18 && metrics.heightCm && metrics.currentWeightKg) {
    const bmi = calculateBMI(metrics.currentWeightKg, metrics.heightCm);
    const category = classifyAdultBMI(bmi);
    result.className = `bmi-result ${category.key}`;
    result.innerHTML = `<span>Tu IMC actual</span><strong>${number(bmi)}</strong><p>${category.label} · referencia para población adulta</p>`;
  } else {
    result.className = 'bmi-result empty';
    result.innerHTML = '<span>IMC</span><strong>—</strong><p>Añade edad, altura y peso para calcularlo.</p>';
  }

  const goalForm = $('#body-goal-form');
  if (document.activeElement !== goalForm.elements.goalType) goalForm.elements.goalType.value = metrics.goalType || 'total';
  setMetricInput(goalForm, 'goalValueKg', metrics.goalValueKg);
  updateGoalFormCopy();
  const isMuscleGoal = metrics.goalType === 'muscle';
  const usableHistory = metrics.history.filter(item => Number(isMuscleGoal ? item.muscleKg : item.weightKg) > 0);
  const currentValue = usableHistory.length ? Number(isMuscleGoal ? usableHistory.at(-1).muscleKg : usableHistory.at(-1).weightKg) : Number(isMuscleGoal ? metrics.currentMuscleKg : metrics.currentWeightKg);
  const startValue = usableHistory.length ? Number(isMuscleGoal ? usableHistory[0].muscleKg : usableHistory[0].weightKg) : currentValue;
  const target = Number(metrics.goalValueKg);
  const goalStatus = $('#body-goal-status');
  if (target > 0) {
    const progress = calculateGoalProgress(startValue, currentValue, target);
    const kind = isMuscleGoal ? 'masa muscular' : 'peso corporal';
    const detail = progress ? (progress.reached ? 'Meta alcanzada' : `${number(progress.remaining)} kg separan tu medida actual de la meta`) : 'Añade una medición actual para ver el progreso';
    goalStatus.innerHTML = `<span>Meta de ${kind}</span><strong>${number(target)} kg</strong><div class="progress-track"><i style="width:${progress?.percent || 0}%"></i></div><small>${detail}${progress ? ` · ${progress.percent}% del recorrido` : ''}</small>`;
  } else {
    goalStatus.innerHTML = '<span>Sin meta activa</span><strong>Elige peso total o masa muscular</strong><div class="progress-track"><i></i></div><small>Podrás cambiarla cuando quieras.</small>';
  }

  const today = localDateKey();
  const logForm = $('#weight-log-form');
  logForm.elements.date.max = today;
  if (!logForm.elements.date.value) logForm.elements.date.value = today;
  const latest = metrics.history.at(-1);
  if (latest) {
    $('#latest-weight').textContent = `${number(latest.weightKg)} kg`;
    const first = metrics.history[0];
    const change = roundQuantity(latest.weightKg - first.weightKg);
    $('#weight-change').textContent = metrics.history.length > 1 ? `${change > 0 ? '+' : change < 0 ? '−' : ''}${number(Math.abs(change))} kg desde el primer registro` : `Registrado el ${formatMetricDate(latest.date)}`;
  } else if (metrics.currentWeightKg) {
    $('#latest-weight').textContent = `${number(metrics.currentWeightKg)} kg`;
    $('#weight-change').textContent = 'Guardado en la calculadora';
  } else {
    $('#latest-weight').textContent = '—';
    $('#weight-change').textContent = 'Sin registros';
  }

  $('#weight-history').innerHTML = metrics.history.length ? [...metrics.history].reverse().map(item => {
    const bmi = metrics.heightCm ? calculateBMI(item.weightKg, metrics.heightCm) : null;
    return `<article class="weight-entry"><time datetime="${item.date}">${formatMetricDate(item.date)}</time><div><b>${number(item.weightKg)} kg</b><small>${bmi ? `IMC ${number(bmi)}` : 'Añade altura para calcular IMC'}${item.muscleKg ? ` · músculo ${number(item.muscleKg)} kg` : ''}</small></div><button type="button" data-delete-weight-entry="${item.id}" aria-label="Eliminar registro del ${formatMetricDate(item.date)}">×</button></article>`;
  }).join('') : '<div class="tracker-empty"><span>↗</span><p>Tu evolución aparecerá aquí cuando guardes el primer registro.</p></div>';
  canvasLabel(metrics.history);
  requestAnimationFrame(drawWeightChart);
}

function canvasLabel(history) {
  const canvas = $('#weight-chart');
  if (!history.length) canvas.setAttribute('aria-label', 'Evolución del peso corporal sin registros todavía');
  else canvas.setAttribute('aria-label', `Evolución del peso corporal con ${history.length} registros, desde ${number(history[0].weightKg)} hasta ${number(history.at(-1).weightKg)} kilogramos`);
}

function saveBodyMetrics(form) {
  const data = new FormData(form);
  const age = Number(data.get('age'));
  const heightCm = Number(data.get('heightCm'));
  const weightKg = Number(data.get('weightKg'));
  const muscleKg = data.get('muscleKg') === '' ? null : Number(data.get('muscleKg'));
  const error = $('#body-metrics-error');
  error.textContent = '';
  try {
    if (!Number.isInteger(age) || age < 18 || age > 120) throw new TypeError('Esta calculadora usa la referencia adulta: indica una edad entre 18 y 120 años.');
    calculateBMI(weightKg, heightCm);
    if (weightKg < 25 || weightKg > 400) throw new TypeError('El peso debe estar entre 25 y 400 kg.');
    if (muscleKg != null && (!Number.isFinite(muscleKg) || muscleKg < 5 || muscleKg > weightKg)) throw new TypeError('La masa muscular debe estar entre 5 kg y tu peso corporal.');
  } catch (problem) { error.textContent = problem.message; return; }
  state.bodyMetrics = { ...state.bodyMetrics, age, heightCm: roundQuantity(heightCm), currentWeightKg: roundQuantity(weightKg), currentMuscleKg: muscleKg == null ? null : roundQuantity(muscleKg) };
  persist(); renderBodyMetrics(); showToast('Medidas guardadas y IMC actualizado');
}

function saveBodyGoal(form) {
  const data = new FormData(form);
  const goalType = data.get('goalType');
  const goalValueKg = Number(data.get('goalValueKg'));
  const error = $('#body-goal-error');
  error.textContent = '';
  const valid = goalType === 'muscle' ? goalValueKg >= 5 && goalValueKg <= 200 : goalValueKg >= 25 && goalValueKg <= 400;
  if (!valid) { error.textContent = goalType === 'muscle' ? 'La meta muscular debe estar entre 5 y 200 kg.' : 'La meta de peso debe estar entre 25 y 400 kg.'; return; }
  state.bodyMetrics.goalType = goalType;
  state.bodyMetrics.goalValueKg = roundQuantity(goalValueKg);
  persist(); renderBodyMetrics(); showToast('Meta corporal guardada');
}

function saveWeightLog(form) {
  const data = new FormData(form);
  const error = $('#weight-log-error');
  error.textContent = '';
  const date = data.get('date');
  if (date > localDateKey()) { error.textContent = 'La fecha no puede estar en el futuro.'; return; }
  try {
    state.bodyMetrics.history = upsertBodyMeasurement(state.bodyMetrics.history, { date, weightKg: data.get('weightKg'), muscleKg: data.get('muscleKg') });
  } catch (problem) { error.textContent = problem.message; return; }
  const latest = state.bodyMetrics.history.at(-1);
  state.bodyMetrics.currentWeightKg = latest.weightKg;
  if (latest.muscleKg != null) state.bodyMetrics.currentMuscleKg = latest.muscleKg;
  persist(); form.elements.weightKg.value = ''; form.elements.muscleKg.value = ''; renderBodyMetrics(); showToast('Registro corporal guardado');
}

function renderAll() { renderWeek(); renderRecipes(); renderPantry(); renderShopping(); renderProfile(); renderBodyMetrics(); }

function openPantryForm(item) {
  const form = $('#pantry-form');
  form.reset();
  $('#pantry-dialog-title').textContent = item ? 'Editar producto' : 'Añadir producto';
  for (const [key, value] of Object.entries(item || {})) if (form.elements[key]) form.elements[key].value = value ?? '';
  $('#pantry-dialog').showModal();
}

function savePantryForm(form) {
  const data = new FormData(form);
  const item = { id: data.get('id') || undefined, name: data.get('name').trim(), quantity: Number(data.get('quantity')), unit: normalizeUnit(data.get('unit')), minQuantity: Number(data.get('minQuantity') || 0), category: data.get('category'), location: data.get('location'), expiry: data.get('expiry'), price: Number(data.get('price') || 0), barcode: data.get('barcode').trim() };
  if (item.id) state.pantry = state.pantry.map(existing => existing.id === item.id ? item : existing);
  else state.pantry = upsertPantryItem(state.pantry, item);
  recalculateShopping(); persist(); renderAll(); $('#pantry-dialog').close(); showToast('Producto guardado y compra recalculada');
}

function parseIngredients(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([\d,.]+)\s*(mg|g|kg|ml|cl|l|unidad(?:es)?|paquete(?:s)?|lata(?:s)?|botella(?:s)?)\s+(.+)$/i);
    if (!match) return null;
    return { amount: Number(match[1].replace(',', '.')), unit: normalizeUnit(match[2]), name: match[3].trim(), category: 'otros' };
  });
}

function saveRecipeForm(form) {
  const data = new FormData(form);
  const ingredients = parseIngredients(data.get('ingredients'));
  if (ingredients.some(item => !item)) { $('#recipe-form-error').textContent = 'Cada ingrediente debe tener “cantidad unidad nombre”, por ejemplo: 200 g garbanzos cocidos.'; return; }
  const traits = data.getAll('traits');
  const recipe = { id: `rec-user-${crypto.randomUUID()}`, name: data.get('name').trim(), emoji: '🍽️', mealTypes: [data.get('mealType')], totalTime: Number(data.get('totalTime')), prepTime: Number(data.get('totalTime')), cookTime: 0, servings: Number(data.get('servings')), nutrition: { kcal: Number(data.get('kcal')), protein: Number(data.get('protein')), carbs: Number(data.get('carbs')), fat: Number(data.get('fat')), fiber: 0 }, estimatedCost: Number(data.get('estimatedCost')), ingredients, description: 'Receta añadida por ti.', steps: data.get('steps').split(/\r?\n/).map(item => item.trim()).filter(Boolean), traits, allergens: traits.map(item => ({ egg: 'huevo', dairy: 'lácteos', soy: 'soja', gluten: 'gluten', nuts: 'frutos secos', fish: 'pescado' })[item]).filter(Boolean), equipment: [], tags: data.get('tags').split(',').map(item => item.trim()).filter(Boolean), rating: 0, ratingCount: 0, ratingType: 'unrated', source: 'Receta personal' };
  const errors = validateRecipe(recipe);
  if (errors.length) { $('#recipe-form-error').textContent = errors.join(' '); return; }
  state.recipes.push(recipe); persist(); renderAll(); $('#recipe-form-dialog').close(); form.reset(); showToast('Receta añadida e indexada'); showRecipe(recipe.id);
}

function prefillProfileForm() {
  const form = $('#onboarding-form');
  const profile = state.profile;
  for (const key of ['diet','calorieTarget','proteinTarget','weeklyBudget','people','maxCookingTime','supermarket']) if (form.elements[key]) form.elements[key].value = profile[key] ?? '';
  form.elements.eatsEgg.checked = profile.eatsEgg !== false;
  form.elements.eatsDairy.checked = profile.eatsDairy !== false;
  form.elements.allergies.value = (profile.allergies || []).join(', ');
  form.elements.dislikes.value = (profile.dislikes || []).join(', ');
  $$('input[name="equipment"]').forEach(input => { input.checked = (profile.equipment || []).includes(input.value); });
}

function saveProfile(form) {
  const data = new FormData(form);
  state.profile = { ...state.profile, configured: true, diet: data.get('diet'), eatsEgg: data.get('eatsEgg') === 'on', eatsDairy: data.get('eatsDairy') === 'on', allergies: data.get('allergies').split(',').map(item => normalizeText(item)).filter(Boolean), dislikes: data.get('dislikes').split(',').map(item => item.trim()).filter(Boolean), calorieTarget: Number(data.get('calorieTarget')), proteinTarget: Number(data.get('proteinTarget')), weeklyBudget: Number(data.get('weeklyBudget')), monthlyBudget: Number(data.get('weeklyBudget')) * 4, people: Number(data.get('people')), maxCookingTime: Number(data.get('maxCookingTime')), supermarket: data.get('supermarket').trim(), equipment: data.getAll('equipment') };
  delete state.profile.name;
  state.menu = state.menu.filter(entry => isRecipeCompatible(findRecipe(entry.recipeId), state.profile));
  runGenerator(state.generationMode || 'balanced');
  $('#onboarding-dialog').close();
  showToast('Perfil guardado; menú y compra actualizados');
}

function openSimple(html, handler) {
  $('#simple-dialog-content').innerHTML = html;
  const cancel = $('#simple-dialog-content .secondary-btn[value="cancel"]');
  if (cancel) { cancel.type = 'button'; cancel.dataset.closeDialog = 'simple-dialog'; }
  simpleHandler = handler;
  $('#simple-dialog').showModal();
}

function openMoveMeal(entryId) {
  const entry = state.menu.find(item => item.id === entryId);
  const recipe = findRecipe(entry.recipeId);
  const alternatives = compatibleRecipes().filter(item => item.mealTypes.includes(entry.mealType) && item.id !== recipe.id);
  openSimple(`<p class="eyebrow">ORGANIZAR MENÚ</p><h2>Mover o sustituir</h2><p class="dialog-intro">${escapeHtml(recipe.name)}</p><div class="form-grid"><label class="full-field"><span>Elegir otra receta para esta comida</span><select name="recipeId"><option value="">Mantener la receta actual</option>${alternatives.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></label><label class="full-field"><span>O mover a otro hueco</span><select name="target"><option value="">No mover</option>${state.menu.filter(item => item.id !== entry.id).map(item => `<option value="${item.id}">${DAY_LABELS[item.day]} · ${MEAL_LABELS[item.mealType]} · ${escapeHtml(findRecipe(item.recipeId)?.name || '')}</option>`).join('')}</select></label></div><label class="check-card"><input type="checkbox" name="copy" /><span><b>Repetir en lugar de intercambiar</b><small>El plato actual también se mantiene.</small></span></label><div class="dialog-actions"><button class="secondary-btn" value="cancel">Cancelar</button><button class="primary-btn" value="default" type="submit">Aplicar</button></div>`, data => {
    const recipeId = data.get('recipeId');
    if (recipeId) entry.recipeId = recipeId;
    const target = state.menu.find(item => item.id === data.get('target'));
    if (target) {
      if (data.get('copy')) target.recipeId = entry.recipeId;
      else [entry.recipeId, target.recipeId] = [target.recipeId, entry.recipeId];
    }
    if (!recipeId && !target) return;
    recalculateShopping(); persist(); renderAll(); showToast('Menú reorganizado');
  });
}

function openAddShopping() {
  openSimple(`<p class="eyebrow">LISTA DE COMPRA</p><h2>Añadir producto</h2><div class="form-grid"><label class="full-field"><span>Producto</span><input name="name" required /></label><label><span>Cantidad</span><input name="quantity" type="number" min="0.01" step="0.01" required /></label><label><span>Unidad</span><select name="unit"><option>g</option><option>kg</option><option>ml</option><option>l</option><option>unidad</option><option>paquete</option><option>lata</option><option>botella</option></select></label><label class="full-field"><span>Categoría</span><select name="category"><option>verduras</option><option>frutas</option><option>refrigerados</option><option>congelados</option><option>cereales</option><option>legumbres</option><option>bebidas</option><option>otros</option></select></label></div><div class="dialog-actions"><button class="secondary-btn" value="cancel">Cancelar</button><button class="primary-btn" value="default" type="submit">Añadir</button></div>`, data => {
    const item = { id: `manual-${crypto.randomUUID()}`, name: data.get('name').trim(), quantity: Number(data.get('quantity')), unit: normalizeUnit(data.get('unit')), category: data.get('category'), source: 'manual', checked: false };
    state.manualShopping.push(item); state.shopping.push(item); persist(); renderShopping(); showToast('Producto añadido');
  });
}

function toggleShopping(id) {
  const item = state.shopping.find(row => row.id === id);
  if (!item) return;
  item.checked = !item.checked;
  if (item.checked && !item.inventoryTransfer && confirm(`¿Añadir ${item.name} a la despensa?`)) {
    state.pantry = upsertPantryItem(state.pantry, { name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, location: ['refrigerados','verduras','frutas'].includes(item.category) ? 'fridge' : 'pantry', minQuantity: 0, expiry: '' });
    item.inventoryTransfer = { name: item.name, quantity: item.quantity, unit: item.unit };
  } else if (!item.checked && item.inventoryTransfer) {
    const transfer = item.inventoryTransfer;
    const pantryItem = state.pantry.find(row => sameFood(row.name, transfer.name) && normalizeUnit(row.unit) === normalizeUnit(transfer.unit));
    if (pantryItem) pantryItem.quantity = roundQuantity(Math.max(0, pantryItem.quantity - transfer.quantity));
    state.pantry = state.pantry.filter(row => row.quantity > 0);
    delete item.inventoryTransfer;
  }
  const manual = state.manualShopping.find(row => row.id === id);
  if (manual) Object.assign(manual, item);
  persist(); renderAll();
}

function cookRecipe(id) {
  const recipe = findRecipe(id);
  const result = consumeRecipe(recipe, recipeServings, state.pantry);
  state.pantry = result.pantry;
  state.cookedHistory.push({ id: crypto.randomUUID(), recipeId: id, cookedAt: new Date().toISOString(), servings: recipeServings });
  recalculateShopping(); persist(); renderAll(); showRecipe(id, recipeServings);
  showToast(result.shortages.length ? `Receta registrada; faltaban ${result.shortages.length} ingredientes en la despensa` : 'Receta preparada: ingredientes descontados de la despensa');
}

async function shareShopping() {
  const text = ['Lista NutriHome', ...state.shopping.filter(item => !item.checked).map(item => `• ${item.name}: ${number(item.quantity)} ${item.unit}`)].join('\n');
  try { if (navigator.share) await navigator.share({ title: 'Lista de compra NutriHome', text }); else { await navigator.clipboard.writeText(text); showToast('Lista copiada'); } } catch { /* user cancelled */ }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `nutrihome-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(link.href);
}

async function importData(file) {
  try { const parsed = JSON.parse(await file.text()); if (parsed.version !== 1 || !parsed.profile || !Array.isArray(parsed.recipes)) throw new Error(); state = normalizeState(parsed); persist(); renderAll(); showToast('Copia restaurada'); } catch { showToast('El archivo no es una copia válida de NutriHome'); }
}

function openImportRecipe() {
  openSimple(`<p class="eyebrow">IMPORTAR RECETA</p><h2>Pega una URL</h2><p class="dialog-intro">NutriHome intentará leer datos estructurados publicados legítimamente por la página. Podrás editar el resultado antes de guardarlo. No se eluden bloqueos ni restricciones.</p><label><span>URL de la receta</span><input name="url" type="url" required placeholder="https://…" /></label><div class="form-error" id="import-error"></div><div class="dialog-actions"><button class="secondary-btn" value="cancel">Cancelar</button><button class="primary-btn" value="default" type="submit">Intentar importar</button></div>`, async data => {
    try {
      const response = await fetch(`./api/import-recipe?url=${encodeURIComponent(data.get('url'))}`);
      if (!response.ok) throw new Error();
      const imported = await response.json();
      $('#recipe-form').elements.name.value = imported.name || '';
      $('#recipe-form').elements.servings.value = imported.servings || 2;
      $('#recipe-form').elements.totalTime.value = imported.totalTime || 25;
      $('#recipe-form').elements.ingredients.value = (imported.ingredients || []).join('\n');
      $('#recipe-form').elements.steps.value = (imported.steps || []).join('\n');
      $('#simple-dialog').close(); $('#recipe-form-dialog').showModal(); showToast('Datos extraídos; revísalos antes de guardar');
    } catch { $('#simple-dialog').close(); $('#recipe-form-dialog').showModal(); showToast('No se pudo extraer automáticamente; puedes estructurarla manualmente'); }
  });
}

function openExerciseForm() {
  openSimple(`<p class="eyebrow">ACTIVIDAD</p><h2>Añadir entrenamiento</h2><div class="form-grid"><label><span>Día</span><select name="day">${DAY_LABELS.map((label,index) => `<option value="${index}">${label}</option>`).join('')}</select></label><label><span>Tipo</span><input name="type" required placeholder="Fuerza, carrera…" /></label><label><span>Duración</span><input name="duration" type="number" min="1" required /><small>minutos</small></label><label><span>Intensidad</span><select name="intensity"><option value="low">Suave</option><option value="medium">Moderada</option><option value="high">Intensa</option></select></label><label class="full-field"><span>Calorías gastadas, si las conoces</span><input name="calories" type="number" min="0" placeholder="Opcional; siempre se mostrará como estimación" /></label></div><div class="dialog-actions"><button class="secondary-btn" value="cancel">Cancelar</button><button class="primary-btn" value="default" type="submit">Guardar</button></div>`, data => {
    state.exercise.push({ id: crypto.randomUUID(), day: Number(data.get('day')), type: data.get('type').trim(), duration: Number(data.get('duration')), intensity: data.get('intensity'), calories: Number(data.get('calories') || 0) }); persist(); renderAll(); showToast('Actividad añadida; se tendrá en cuenta al regenerar');
  });
}

function bindEvents() {
  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-nav]'); if (nav) { navigate(nav.dataset.nav); return; }
    const day = event.target.closest('[data-day]'); if (day) { activeDay = Number(day.dataset.day); renderWeek(); return; }
    const generator = event.target.closest('[data-generate-mode]'); if (generator) { runGenerator(generator.dataset.generateMode); return; }
    const favorite = event.target.closest('[data-favorite]'); if (favorite) { event.stopPropagation(); const id = favorite.dataset.favorite; state.favorites = state.favorites.includes(id) ? state.favorites.filter(item => item !== id) : [...state.favorites, id]; persist(); renderRecipes(); if ($('#recipe-dialog').open) showRecipe(id, recipeServings); return; }
    const open = event.target.closest('[data-open-recipe]'); if (open) { showRecipe(open.dataset.openRecipe); return; }
    const lock = event.target.closest('[data-lock]'); if (lock) { const entry = state.menu.find(item => item.id === lock.dataset.lock); entry.locked = !entry.locked; persist(); renderWeek(); showToast(entry.locked ? 'Comida bloqueada' : 'Comida desbloqueada'); return; }
    const regenerate = event.target.closest('[data-regenerate]'); if (regenerate) { const entry = state.menu.find(item => item.id === regenerate.dataset.regenerate); state.menu = regenerateMeal({ entry, menu: state.menu, recipes: state.recipes, profile: state.profile, pantry: state.pantry, mode: state.generationMode }); recalculateShopping(); persist(); renderAll(); showToast(entry.locked ? 'Desbloquea la comida para regenerarla' : 'Comida sustituida'); return; }
    const move = event.target.closest('[data-move-meal]'); if (move) { openMoveMeal(move.dataset.moveMeal); return; }
    const delta = event.target.closest('[data-pantry-delta]'); if (delta) { const item = state.pantry.find(row => row.id === delta.dataset.pantryId); item.quantity = roundQuantity(Math.max(0, item.quantity + Number(delta.dataset.pantryDelta))); state.pantry = state.pantry.filter(row => row.quantity > 0); recalculateShopping(); persist(); renderAll(); return; }
    const edit = event.target.closest('[data-edit-pantry]'); if (edit) { openPantryForm(state.pantry.find(item => item.id === edit.dataset.editPantry)); return; }
    const check = event.target.closest('[data-check-shopping]'); if (check) { toggleShopping(check.dataset.checkShopping); return; }
    const removeShopping = event.target.closest('[data-delete-shopping]'); if (removeShopping) { state.shopping = state.shopping.filter(item => item.id !== removeShopping.dataset.deleteShopping); state.manualShopping = state.manualShopping.filter(item => item.id !== removeShopping.dataset.deleteShopping); persist(); renderShopping(); return; }
    const removeWeight = event.target.closest('[data-delete-weight-entry]'); if (removeWeight) { if (!confirm('¿Eliminar este registro corporal?')) return; state.bodyMetrics.history = state.bodyMetrics.history.filter(item => item.id !== removeWeight.dataset.deleteWeightEntry); const latest = state.bodyMetrics.history.at(-1); state.bodyMetrics.currentWeightKg = latest?.weightKg || null; state.bodyMetrics.currentMuscleKg = latest?.muscleKg || null; persist(); renderBodyMetrics(); showToast('Registro eliminado'); return; }
    const close = event.target.closest('[data-close-dialog]'); if (close) { $(`#${close.dataset.closeDialog}`).close(); return; }
    const addLow = event.target.closest('[data-add-low-stock]'); if (addLow) { const low = state.pantry.filter(item => item.minQuantity > 0 && item.quantity <= item.minQuantity); for (const item of low) { if (state.shopping.some(row => sameFood(row.name, item.name) && !row.checked)) continue; const quantity = roundQuantity(Math.max(pantryStep(item), item.minQuantity - item.quantity)); const manual = { id: `manual-${crypto.randomUUID()}`, name: item.name, quantity, unit: item.unit, category: item.category, source: 'manual', checked: false }; state.manualShopping.push(manual); state.shopping.push(manual); } persist(); renderAll(); navigate('shopping'); showToast('Faltantes añadidos a la compra'); return; }
    const rate = event.target.closest('[data-rate]'); if (rate) { state.ratings[activeRecipeId] = Number(rate.dataset.rate); persist(); showRecipe(activeRecipeId, recipeServings); return; }
    const cook = event.target.closest('[data-cook-recipe]'); if (cook) { cookRecipe(cook.dataset.cookRecipe); return; }
  });
  document.addEventListener('keydown', event => {
    const card = event.target.closest('.recipe-card[role="button"]');
    if (card && event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); showRecipe(card.dataset.openRecipe); }
  });
  $('#open-generator').addEventListener('click', () => $('#generator-dialog').showModal());
  $('#generator-form').addEventListener('submit', event => { event.preventDefault(); const mode = event.submitter.value; $('#generator-dialog').close(); runGenerator(mode); });
  $('#recipe-search').addEventListener('input', renderRecipes); $('#filter-meal').addEventListener('change', renderRecipes); $('#filter-time').addEventListener('change', renderRecipes); $('#filter-protein').addEventListener('change', renderRecipes); $('#filter-diet').addEventListener('change', renderRecipes); $('#filter-pantry').addEventListener('change', renderRecipes);
  $('#what-can-cook').addEventListener('click', () => { navigate('recipes'); $('#filter-pantry').checked = true; renderRecipes(); });
  $('#pantry-search').addEventListener('input', renderPantry); $('#pantry-location').addEventListener('change', renderPantry);
  $('#add-pantry').addEventListener('click', () => openPantryForm()); $('#pantry-form').addEventListener('submit', event => { event.preventDefault(); savePantryForm(event.currentTarget); });
  $('#add-recipe').addEventListener('click', () => { $('#recipe-form').reset(); $('#recipe-form-error').textContent = ''; $('#recipe-form-dialog').showModal(); }); $('#recipe-form').addEventListener('submit', event => { event.preventDefault(); saveRecipeForm(event.currentTarget); });
  $('#import-recipe').addEventListener('click', openImportRecipe); $('#add-shopping').addEventListener('click', openAddShopping); $('#share-shopping').addEventListener('click', shareShopping); $('#refresh-shopping').addEventListener('click', () => { recalculateShopping(); persist(); renderShopping(); showToast('Lista recalculada'); });
  $('#onboarding-form').addEventListener('submit', event => { event.preventDefault(); saveProfile(event.currentTarget); }); $('#edit-profile').addEventListener('click', () => { prefillProfileForm(); $('#onboarding-dialog').showModal(); });
  $('#body-metrics-form').addEventListener('submit', event => { event.preventDefault(); saveBodyMetrics(event.currentTarget); });
  $('#body-goal-form').addEventListener('submit', event => { event.preventDefault(); saveBodyGoal(event.currentTarget); });
  $('#body-goal-type').addEventListener('change', updateGoalFormCopy);
  $('#weight-log-form').addEventListener('submit', event => { event.preventDefault(); saveWeightLog(event.currentTarget); });
  $('#simple-form').addEventListener('submit', event => { event.preventDefault(); const data = new FormData(event.currentTarget); const handler = simpleHandler; $('#simple-dialog').close(); simpleHandler = null; handler?.(data); });
  $('#recipe-dialog').addEventListener('change', event => { if (event.target.id === 'recipe-servings') showRecipe(activeRecipeId, event.target.value); });
  $('#add-exercise').addEventListener('click', openExerciseForm); $('#export-data').addEventListener('click', exportData); $('#import-data').addEventListener('change', event => { if (event.target.files[0]) importData(event.target.files[0]); event.target.value = ''; });
  $('#notifications').addEventListener('click', () => {
    const low = state.pantry.filter(item => item.minQuantity > 0 && item.quantity <= item.minQuantity);
    const expiring = state.pantry.filter(item => ['soon', 'today'].includes(getExpiryStatus(item.expiry).key));
    openSimple(`<p class="eyebrow">AVISOS</p><h2>Tu casa al día</h2><p class="dialog-intro">${low.length ? `${low.length} productos están bajo el mínimo.` : 'No hay productos bajo el mínimo.'}</p><p class="dialog-intro">${expiring.length ? `${expiring.map(item => escapeHtml(item.name)).join(', ')} conviene usar pronto.` : 'No hay caducidades próximas.'}</p><div class="dialog-actions"><button class="primary-btn" type="button" data-close-dialog="simple-dialog">Entendido</button></div>`, null);
  });
  $('#reset-preferences').addEventListener('click', () => { if (!confirm('¿Reiniciar favoritos, valoraciones e historial?')) return; state.favorites = []; state.ratings = {}; state.cookedHistory = []; state.dismissedRecipes = []; persist(); renderAll(); showToast('Preferencias reiniciadas'); });
  $('#delete-data').addEventListener('click', async () => { if (!confirm('¿Eliminar todos los datos de NutriHome en este dispositivo?')) return; await clearLocalState(); state = initialState(); renderAll(); persist({ remote: false }); prefillProfileForm(); $('#onboarding-dialog').showModal(); });
  window.addEventListener('online', () => { updateSyncBadge('pending'); persist(); }); window.addEventListener('offline', () => updateSyncBadge('offline'));
  window.addEventListener('resize', () => requestAnimationFrame(drawWeightChart));
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#install-app').hidden = false; }); $('#install-app').addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#install-app').hidden = true; });
}

async function init() {
  const local = await loadLocalState();
  const remote = await pullRemoteState();
  state = normalizeState(newestSnapshot(local, remote.state));
  state = await saveLocalState(state);
  updateSyncBadge(remote.status);
  bindEvents(); renderAll();
  const route = location.hash.slice(1); if (['week','recipes','pantry','shopping','more'].includes(route)) navigate(route, false);
  if (!state.profile.configured) { prefillProfileForm(); setTimeout(() => $('#onboarding-dialog').showModal(), 250); }
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => updateSyncBadge('offline')));
}

init().catch(error => { console.error(error); $('#main-content').innerHTML = `<div class="empty-state"><span>!</span><h1>No pudimos abrir NutriHome</h1><p>Tus datos siguen a salvo. Recarga para intentarlo de nuevo.</p><button class="primary-btn" onclick="location.reload()">Reintentar</button></div>`; });
