import { RECIPE_PHOTOS } from '../recipe-photos.js';
import { writeFile } from 'node:fs/promises';
// Same exact URLs used by the UI and service worker, available before the first render.
await writeFile(new URL('../recipe-image-list.js', import.meta.url), `self.RECIPE_IMAGE_URLS = ${JSON.stringify(Object.values(RECIPE_PHOTOS).map(photo => photo.src))};\n`);
