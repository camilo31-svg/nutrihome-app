const STORES = new Set(['mercadona', 'consum', 'aldi']);
const ALDI = { app: 'L9KNU74IO7', key: '83df5acd172c42ab174afa4583232b5d', index: 'an_prd_es_es_pen_products2' };
const MERCADONA = { app: '7UZJKL1DJ0', key: '9d8f2e39e90df472b4f2e559a116fe17', index: 'products_prod_bcn1_es' };

const validPrice = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const safeUrl = (value, host) => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host ? url.href : null; }
  catch { return null; }
};

export function normalizeStoreProducts(store, data) {
  const rows = store === 'consum' ? data?.products : data?.hits;
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 18).map(row => {
    if (store === 'mercadona') return {
      id: String(row.id || ''), name: String(row.display_name || '').slice(0, 120),
      pack: [row.price_instructions?.unit_size, row.price_instructions?.size_format].filter(Boolean).join(' '),
      price: validPrice(row.price_instructions?.unit_price),
      unitPrice: validPrice(row.price_instructions?.reference_price),
      unitLabel: String(row.price_instructions?.reference_format || '').slice(0, 16),
      url: safeUrl(row.share_url, 'tienda.mercadona.es')
    };
    if (store === 'consum') return {
      id: String(row.code || row.id || ''), name: String(row.productData?.description || row.productData?.name || '').slice(0, 120),
      pack: String(row.priceData?.unitPriceUnitType || '').slice(0, 30),
      price: validPrice(row.priceData?.prices?.[0]?.value?.centAmount),
      unitPrice: validPrice(row.priceData?.prices?.[0]?.value?.centUnitAmount),
      unitLabel: String(row.priceData?.unitPriceUnitType || '').slice(0, 16),
      url: safeUrl(row.productData?.url, 'tienda.consum.es')
    };
    return {
      id: String(row.objectID || row.id || ''), name: String(row.name || '').slice(0, 120),
      pack: String(row.salesUnit || '').slice(0, 30),
      price: validPrice(row.currentPrice?.priceValue),
      unitPrice: validPrice(row.currentPrice?.basePrice?.[0]?.basePriceValue),
      unitLabel: String(row.currentPrice?.basePrice?.[0]?.basePriceUnit || '').slice(0, 16),
      url: row.productSlug && /^[a-z0-9-]+$/i.test(row.productSlug) ? `https://www.aldi.es/producto/${row.productSlug}.html` : null
    };
  }).filter(item => item.id && item.name && item.price !== null);
}

export async function searchPublicStore(store, rawQuery, fetcher = fetch) {
  const query = String(rawQuery || '').trim().replace(/\s+/g, ' ');
  if (!STORES.has(store) || query.length < 2 || query.length > 60 || /[^\p{L}\p{N}\s.,'-]/u.test(query))
    throw new Error('invalid_search');
  let upstream;
  if (store === 'consum') {
    upstream = await fetcher(`https://tienda.consum.es/api/rest/V1.0/catalog/product?q=${encodeURIComponent(query)}`, {
      headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000)
    });
  } else {
    const config = store === 'mercadona' ? MERCADONA : ALDI;
    upstream = await fetcher(`https://${config.app}-dsn.algolia.net/1/indexes/${config.index}/query`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-algolia-application-id': config.app, 'x-algolia-api-key': config.key },
      body: JSON.stringify({ query, hitsPerPage: 18 }), signal: AbortSignal.timeout(8000)
    });
  }
  if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
  const products = normalizeStoreProducts(store, await upstream.json());
  return { store, query, products, checkedAt: new Date().toISOString(), region: store === 'mercadona' ? 'Barcelona' : store === 'aldi' ? 'Península' : 'Catálogo público Consum' };
}

export async function storeSearchApi(request, fetcher = fetch) {
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  const url = new URL(request.url);
  const store = url.searchParams.get('store') || '';
  const query = url.searchParams.get('q') || '';
  if (!STORES.has(store) || query.trim().length < 2 || query.length > 60 || /[^\p{L}\p{N}\s.,'-]/u.test(query))
    return Response.json({ error: 'invalid_search' }, { status: 400 });
  try {
    const data = await searchPublicStore(store, query, fetcher);
    return Response.json(data, { headers: { 'cache-control': 'public, max-age=300, s-maxage=600' } });
  } catch {
    return Response.json({ error: 'price_unavailable' }, { status: 502, headers: { 'cache-control': 'no-store' } });
  }
}
