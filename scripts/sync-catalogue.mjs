/* ---------------------------------------------------------
   Pulls the Beyblade X product catalogue into public/catalogue.json,
   which sellers browse from when listing an item for sale (see
   CataloguePicker in src/App.jsx) — picking a real released product
   instead of typing a free-text name keeps listings consistent and
   gives every listing a real product photo.

   Source: https://beyblade.phstudy.org (a fan-run Beyblade X database).
   Each entry in CATEGORIES below pulls one of its category pages into
   one of the marketplace's listing types (see ITEM_TYPES in App.jsx).

   The catalogue is rendered client-side (it merges several JSON files
   under /data/ at runtime), so a plain fetch of the page only gets an
   empty shell — unlike worldbeyblade.org, though, phstudy.org doesn't
   block automated requests at all, so a real (headless) browser can
   load each category page and read the rendered cards directly. Images
   are then fetched as plain files and self-hosted under
   public/catalogue-images/, same reasoning as sync-wbo-rules.mjs.

   Usage: node scripts/sync-catalogue.mjs
--------------------------------------------------------- */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const SITE = "https://beyblade.phstudy.org/";
const CATEGORIES = [
  { category: "Box", itemType: "Beyblade" },
  { category: "Stadium", itemType: "Stadium" },
  { category: "Grip", itemType: "Launcher" },
];
const OUT_FILE = new URL("../public/catalogue.json", import.meta.url);
const IMAGES_DIR = new URL("../public/catalogue-images/", import.meta.url);

function fail(msg) {
  console.error(`sync-catalogue: ${msg}`);
  process.exit(1);
}

async function extractCategory(page, category) {
  const url = `${SITE}index.en-US.html?category=${category}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector(".card-box", { timeout: 20000 });
  return page.$$eval(".card-box", (cards) =>
    cards.map((card) => {
      const idMatch = (card.getAttribute("onclick") || "").match(/openProductModal\('([^']+)'/);
      const img = card.querySelector("img");
      return {
        id: idMatch ? idMatch[1] : null,
        thumbSrc: img?.getAttribute("src") || null,
        alt: img?.getAttribute("alt") || null,
      };
    })
  );
}

const browser = await chromium.launch();
let raw;
try {
  const page = await browser.newPage();
  raw = [];
  for (const { category, itemType } of CATEGORIES) {
    const entries = await extractCategory(page, category);
    if (entries.length === 0) fail(`found no cards for category=${category} — has the site's markup changed?`);
    for (const entry of entries) raw.push({ ...entry, itemType });
    console.log(`sync-catalogue: ${category} -> ${itemType} (${entries.length} items)`);
  }
} finally {
  await browser.close();
}

await mkdir(IMAGES_DIR, { recursive: true });

const items = [];
const seenImageFiles = new Set();
for (const entry of raw) {
  if (!entry.id || !entry.thumbSrc || !entry.alt) continue;
  const imageUrl = new URL(entry.thumbSrc, SITE);
  imageUrl.search = ""; // drop the cache-busting ?v= param
  // the same product can appear under more than one category (e.g. a
  // boxed set that includes a stadium) with a different photo each
  // time, so the file name comes from the image path, not the id —
  // keeps every distinct photo while still deduping true repeats.
  const fileName = imageUrl.pathname.split("/").pop();

  if (!seenImageFiles.has(fileName)) {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`sync-catalogue: image fetch failed for ${entry.id} (HTTP ${res.status}), skipping`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(new URL(fileName, IMAGES_DIR), buf);
    seenImageFiles.add(fileName);
  }

  items.push({
    id: entry.id,
    name: entry.alt.replace(/\s+/g, " ").trim(),
    image: `catalogue-images/${fileName}`,
    itemType: entry.itemType,
  });
}

if (items.length === 0) fail("no items survived — check the site's markup");

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
      source: SITE,
      syncedAt: new Date().toISOString(),
      hash,
      items,
    },
    null,
    2
  ) + "\n"
);
console.log(`sync-catalogue: updated (${previous?.hash ?? "none"} -> ${hash}, ${items.length} items)`);
