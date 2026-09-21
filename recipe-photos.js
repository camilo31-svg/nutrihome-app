import { RECIPE_LIBRARY } from './recipe-library.js?v=1.9.0';
import { groupRecipeFamilies, recipeFamilyId } from './recipe-families.js?v=1.9.0';

// One reviewed, local file per base recipe. Never search or guess an image at runtime.
export const RECIPE_PHOTOS = Object.freeze(Object.fromEntries(groupRecipeFamilies(RECIPE_LIBRARY).map(group => [group.id, Object.freeze({
  src: `./recipe-images/${group.id}.webp`,
  recipeId: group.recipes[0].id,
  name: group.recipes[0].name,
  ingredients: group.recipes[0].ingredients.map(item => item.name),
  credit: 'Imagen de la receta base generada con IA',
})])));

export function recipePhoto(recipe) {
  if (!recipe || recipe.hasCustomCover) return null;
  return RECIPE_PHOTOS[recipeFamilyId(recipe)] || null;
}
