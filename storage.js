const DB_NAME = 'nutrihome-local';
const DB_VERSION = 2;
const STORE = 'snapshots';
const IMAGE_STORE = 'recipe-images';
const STATE_KEY = 'current';

export function isPersonalRecipe(recipe) {
  return recipe?.source === 'Receta personal' || String(recipe?.id || '').startsWith('rec-user-');
}

export function createStateSnapshot(state) {
  return { ...state, recipes: (state?.recipes || []).filter(isPersonalRecipe) };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, action, storeName = STORE) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function loadLocalState() {
  try {
    const record = await transact('readonly', store => store.get(STATE_KEY));
    return record?.value || null;
  } catch {
    return null;
  }
}

export async function saveLocalState(state) {
  const snapshot = { ...state, updatedAt: new Date().toISOString() };
  await transact('readwrite', store => store.put({ key: STATE_KEY, value: snapshot }));
  return snapshot;
}

export async function clearLocalState() {
  try { await transact('readwrite', store => store.delete(STATE_KEY)); } catch { /* already empty */ }
  try { await transact('readwrite', store => store.clear(), IMAGE_STORE); } catch { /* already empty */ }
}

export async function saveRecipeImage(recipeId, blob) {
  if (!(blob instanceof Blob) || !recipeId) throw new TypeError('Imagen de receta no válida.');
  return transact('readwrite', store => store.put({ key: recipeId, blob, updatedAt: new Date().toISOString() }), IMAGE_STORE);
}

export async function loadRecipeImage(recipeId) {
  try {
    const record = await transact('readonly', store => store.get(recipeId), IMAGE_STORE);
    return record?.blob || null;
  } catch { return null; }
}

export async function deleteRecipeImage(recipeId) {
  try { await transact('readwrite', store => store.delete(recipeId), IMAGE_STORE); } catch { /* already empty */ }
}

export async function pullRemoteState() {
  if (!navigator.onLine) return { state: null, status: 'offline' };
  try {
    const response = await fetch('./api/state', { headers: { accept: 'application/json' } });
    if (response.status === 404 || response.status === 401 || response.status === 503) return { state: null, status: 'local' };
    if (!response.headers.get('content-type')?.includes('application/json')) return { state: null, status: 'local' };
    if (!response.ok) throw new Error('No se pudo sincronizar');
    const body = await response.json();
    return { state: body.state || null, status: 'synced' };
  } catch {
    return { state: null, status: navigator.onLine ? 'pending' : 'offline' };
  }
}

export async function pushRemoteState(state) {
  if (!navigator.onLine) return 'offline';
  try {
    const response = await fetch('./api/state', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state })
    });
    if (response.status === 404 || response.status === 401 || response.status === 503) return 'local';
    return response.ok && response.headers.get('content-type')?.includes('application/json') ? 'synced' : 'pending';
  } catch {
    return 'pending';
  }
}

export function newestSnapshot(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  return String(remote.updatedAt || '') > String(local.updatedAt || '') ? remote : local;
}
