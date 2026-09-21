// Explicit culinary families: ingredient alternatives keep their stable recipe IDs.
export function recipeFamilyId(recipe) {
  return recipe.familyId || recipe.id;
}

export function groupRecipeFamilies(recipes) {
  const groups = new Map();
  for (const recipe of recipes) {
    const key = recipeFamilyId(recipe);
    if (!groups.has(key)) groups.set(key, { id: key, title: recipe.familyName || recipe.name, recipes: [] });
    groups.get(key).recipes.push(recipe);
  }
  return [...groups.values()];
}

export function distinctFamilyCandidates(ranked, limit = 100) {
  const seen = new Set();
  return ranked.filter(recipe => {
    const family = recipeFamilyId(recipe);
    if (seen.has(family)) return false;
    seen.add(family);
    return true;
  }).slice(0, limit);
}
