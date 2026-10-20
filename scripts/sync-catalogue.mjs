/* ---------------------------------------------------------
   Pulls the Beyblade X product catalogue into public/catalogue.json,
   which sellers browse from when listing an item for sale (see
   CataloguePicker in src/App.jsx) — picking a real released product
   instead of typing a free-text name keeps listings consistent and
   gives every listing a real product photo.

   Source: https://beyblade.phstudy.org (a fan-run Beyblade X database),
   specifically its "Box" category — complete released products
   (boosters, starters, sets), the same granularity a seller would
   actually own and resell.

   The catalogue is rendered client-side (it merges several JSON files
   under /data/ at runtime), so it can't be scraped with a plain fetch
   the way this script fetches images. Instead, the item list is
   extracted once per sync by running this snippet in a browser on
   https://beyblade.phstudy.org/index.en-US.html?category=Box :

     copy(JSON.stringify(Array.from(document.querySelectorAll('.card-box')).map(card => {
       const id = (card.getAttribute('onclick') || '').match(/openProductModal\('([^']+)'\)/)?.[1] || null;
       const img = card.querySelector('img');
       return { id, thumbSrc: img?.getAttribute('src'), alt: img?.getAttribute('alt') };
     })))

   ...paste the result into a file and pass it as this script's
   argument. Images are then fetched directly (phstudy.org doesn't
   block automated requests, unlike worldbeyblade.org) and self-hosted
   under public/catalogue-images/, same reasoning as sync-wbo-rules.mjs.

   Usage: node scripts/sync-catalogue.mjs <extracted-items.json>
--------------------------------------------------------- */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const SOURCE_URL = "https://beyblade.phstudy.org/index.en-US.html?category=Box";
const IMAGE_BASE = "https://beyblade.phstudy.org/";
const OUT_FILE = new URL("../public/catalogue.json", import.meta.url);
const IMAGES_DIR = new URL("../public/catalogue-images/", import.meta.url);

function fail(msg) {
  console.error(`sync-catalogue: ${msg}`);
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) fail("usage: node scripts/sync-catalogue.mjs <extracted-items.json>");

const raw = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(raw) || raw.length === 0) fail("input file has no items");

await mkdir(IMAGES_DIR, { recursive: true });

const items = [];
for (const entry of raw) {
  if (!entry.id || !entry.thumbSrc || !entry.alt) continue;
  const imageUrl = new URL(entry.thumbSrc, IMAGE_BASE);
  imageUrl.search = ""; // drop the cache-busting ?v= param
  const ext = imageUrl.pathname.split(".").pop();
  const fileName = `${entry.id}.${ext}`;

  const res = await fetch(new URL(entry.thumbSrc, IMAGE_BASE));
  if (!res.ok) {
    console.warn(`sync-catalogue: image fetch failed for ${entry.id} (HTTP ${res.status}), skipping`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(fileName, IMAGES_DIR), buf);

  items.push({
    id: entry.id,
    name: entry.alt.replace(/\s+/g, " ").trim(),
    image: `catalogue-images/${fileName}`,
  });
}

if (items.length === 0) fail("no items survived — check the input file");

const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex").slice(0, 16);
let previous = null;
try {
  previous = JSON.parse(await readFile(OUT_FILE, "utf8"));
} catch {
  // first run — no existing copy
}
if (previous?.hash === hash) {
  console.log(`sync-catalogue: unchanged (${hash})`);
  process.exit(0);
}

await writeFile(
  OUT_FILE,
  JSON.stringify(
    {
      source: SOURCE_URL,
      syncedAt: new Date().toISOString(),
      hash,
      items,
    },
    null,
    2
  ) + "\n"
);
console.log(`sync-catalogue: updated (${previous?.hash ?? "none"} -> ${hash}, ${items.length} items)`);
