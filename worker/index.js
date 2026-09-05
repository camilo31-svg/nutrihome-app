const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

async function ensureStateTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_snapshots (
    user_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
}

function currentUser(request) { return request.headers.get('oai-authenticated-user-id') || ''; }

async function stateApi(request, env) {
  if (!env.DB) return json({ error: 'sync_not_configured' }, 503);
  const userId = currentUser(request);
  if (!userId) return json({ error: 'authentication_required' }, 401);
  await ensureStateTable(env.DB);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT state_json FROM user_snapshots WHERE user_id = ?').bind(userId).first();
    return json({ state: row ? JSON.parse(row.state_json) : null });
  }
  if (request.method === 'PUT') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 1_500_000) return json({ error: 'snapshot_too_large' }, 413);
    const body = await request.json().catch(() => null);
    if (!body?.state || body.state.version !== 1) return json({ error: 'invalid_snapshot' }, 400);
    const serialized = JSON.stringify(body.state);
    if (serialized.length > 1_500_000) return json({ error: 'snapshot_too_large' }, 413);
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO user_snapshots (user_id, state_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`).bind(userId, serialized, updatedAt).run();
    return json({ ok: true, updatedAt });
  }
  return json({ error: 'method_not_allowed' }, 405);
}

function isSafeRecipeUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || host.endsWith('.local')) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch { return false; }
}

function findRecipeObject(value) {
  if (!value || typeof value !== 'object') return null;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Recipe')) return value;
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) { for (const item of child) { const found = findRecipeObject(item); if (found) return found; } }
    else if (child && typeof child === 'object') { const found = findRecipeObject(child); if (found) return found; }
  }
  return null;
}

function durationMinutes(value = '') {
  const match = String(value).match(/^PT(?:(\d+)H)?(?:(\d+)M)?/i);
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : 0;
}

function extractRecipe(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const value = JSON.parse(match[1].trim());
      const recipe = findRecipeObject(value);
      if (!recipe) continue;
      const instructions = Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions.map(step => typeof step === 'string' ? step : step.text).filter(Boolean) : String(recipe.recipeInstructions || '').split(/\r?\n/).filter(Boolean);
      const servingsMatch = String(recipe.recipeYield || '').match(/\d+/);
      return {
        name: String(recipe.name || '').slice(0, 120), servings: Number(servingsMatch?.[0] || 2),
        totalTime: durationMinutes(recipe.totalTime) || durationMinutes(recipe.prepTime) + durationMinutes(recipe.cookTime) || 25,
        ingredients: (recipe.recipeIngredient || []).map(item => String(item).slice(0, 180)).slice(0, 60),
        steps: instructions.map(item => String(item).replace(/<[^>]+>/g, '').trim().slice(0, 800)).slice(0, 40),
        sourceUrl: String(recipe.url || '')
      };
    } catch { /* malformed third-party JSON-LD; try the next block */ }
  }
  return null;
}

async function importRecipe(request) {
  const target = new URL(request.url).searchParams.get('url') || '';
  if (!isSafeRecipeUrl(target)) return json({ error: 'invalid_url' }, 400);
  try {
    const response = await fetch(target, { headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'NutriHome recipe importer/1.0' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return json({ error: 'unsupported_source' }, 422);
    const html = (await response.text()).slice(0, 2_500_000);
    const recipe = extractRecipe(html);
    return recipe ? json(recipe) : json({ error: 'recipe_data_not_found' }, 422);
  } catch { return json({ error: 'import_failed' }, 502); }
}

function secure(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('x-content-type-options', 'nosniff');
  secured.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  secured.headers.set('permissions-policy', 'camera=(self), geolocation=()');
  secured.headers.set('content-security-policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return secured;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/state') return stateApi(request, env);
    if (url.pathname === '/api/import-recipe' && request.method === 'GET') return importRecipe(request);
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return secure(response);
    if (!request.headers.get('accept')?.includes('text/html')) return secure(response);
    return secure(await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request)));
  }
};
