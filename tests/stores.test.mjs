import assert from 'node:assert/strict';
import { normalizeStoreProducts, searchPublicStore, storeSearchApi } from '../worker/store-prices.js';

assert.deepEqual(normalizeStoreProducts('mercadona', { hits: [{ id: '5044', display_name: 'Arroz redondo', share_url: 'https://tienda.mercadona.es/product/5044/arroz', price_instructions: { unit_price: '1.15', reference_price: '1.15', reference_format: 'kg' } }] })[0].price, 1.15);
assert.equal(normalizeStoreProducts('consum', { products: [{ code: '7022754', productData: { description: 'Arroz largo 1 Kg', url: 'https://tienda.consum.es/es/p/arroz/7022754' }, priceData: { prices: [{ value: { centAmount: 1.2 } }] } }] })[0].price, 1.2);
assert.equal(normalizeStoreProducts('aldi', { hits: [{ objectID: '768700', name: 'Arroz redondo', productSlug: 'arroz-redondo-768700', currentPrice: { priceValue: 1.09 } }] })[0].url, 'https://www.aldi.es/producto/arroz-redondo-768700.html');
assert.equal(normalizeStoreProducts('consum', { products: [{ code: '1', productData: { name: 'Sin precio' } }] }).length, 0);
let requested = '';
const response = await storeSearchApi(new Request('https://nutrihome.test/api/store-search?store=mercadona&q=arroz'), async url => { requested = url; return Response.json({ hits: [{ id: '1', display_name: 'Arroz', price_instructions: { unit_price: '1.15' } }] }); });
assert.equal(response.status, 200);
assert.match(requested, /algolia.net/);
assert.equal((await response.json()).products[0].price, 1.15);
assert.equal((await storeSearchApi(new Request('https://nutrihome.test/api/store-search?store=other&q=arroz'), () => { throw new Error('called'); })).status, 400);
const direct = await searchPublicStore('aldi', 'arroz', async (url, options) => {
  assert.match(url, /algolia.net/);
  assert.equal(options.method, 'POST');
  return Response.json({ hits: [{ objectID: '768700', name: 'Arroz redondo', currentPrice: { priceValue: 1.09 } }] });
});
assert.equal(direct.products[0].price, 1.09, 'GitHub Pages puede usar la búsqueda directa sin Worker');
console.log('Store price provider mapping and request validation passed');
