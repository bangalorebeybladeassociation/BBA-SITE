/* ---------------------------------------------------------
   Pulls the official WBO Beyblade X rules (first post of the
   worldbeyblade.org thread) into public/wbo-rules.json, which the
   Rulebook section loads at runtime. Run daily by
   .github/workflows/sync-wbo-rules.yml — a static site can't fetch
   worldbeyblade.org from the visitor's browser (no CORS), so the
   copy lives in the repo and a change triggers a redeploy.

   The forum HTML is sanitized here to a small tag allowlist, so the
   site can render the stored html without trusting the forum.
   The file is only rewritten when the rules text actually changes,
   so an unchanged day produces no commit.

   Usage: node scripts/sync-wbo-rules.mjs [saved-thread.html] [local-images-dir]
   (pass a saved copy of the thread page to test without fetching; the
   rules' images are hotlinked to worldbeyblade.org by default, so when
   a local-images-dir is given, any <img> whose basename matches a file
   in it is copied into public/wbo-rules-images/ and rewritten to a
   relative src instead — self-hosted, same as the rules text itself)
--------------------------------------------------------- */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";

const SOURCE_URL = "https://worldbeyblade.org/Thread-Beyblade-X-Rules";
const OUT_FILE = new URL("../public/wbo-rules.json", import.meta.url);
const IMAGES_DIR = new URL("../public/wbo-rules-images/", import.meta.url);
const localImagesDir = process.argv[3] ? new URL(process.argv[3] + "/", `file://${process.cwd()}/`) : null;
const localImageNames = new Set(
  localImagesDir && existsSync(localImagesDir) ? readdirSync(localImagesDir) : []
);
if (localImageNames.size) await mkdir(IMAGES_DIR, { recursive: true });
// The real rules post is many thousands of characters; anything this short
// means we scraped a login wall, Cloudflare check or changed layout.
const MIN_TEXT_LENGTH = 1500;

function fail(msg) {
  console.error(`sync-wbo-rules: ${msg}`);
  process.exit(1);
}

async function loadPage() {
  if (process.argv[2]) return readFile(process.argv[2], "utf8");
  const res = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": "BBA-site-rules-sync (+https://github.com/bangalorebeybladeassociation/BBA-SITE)",
      Accept: "text/html",
    },
  });
  if (!res.ok) fail(`fetch failed: HTTP ${res.status}`);
  return res.text();
}

const page = await loadPage();
const $ = cheerio.load(page);

// MyBB: every post body is .post_body; the rules are the thread's first post.
// This particular thread renders as a "resource" page (.post_body directly
// inside #content-div, no .post wrapper) rather than the classic thread
// view, so fall back to the first .post_body on the page when no .post
// ancestor is found.
const firstPost = $(".post").has(".post_body").first();
const body = firstPost.find(".post_body").first().length ? firstPost.find(".post_body").first() : $(".post_body").first();
if (!body.length) fail("couldn't find the first post (.post_body) — has the forum layout changed?");

const title = ($(".thread_title, #content .thead strong").first().text() || $("title").text())
  .replace(/\s+/g, " ")
  .trim();
// MyBB appends "(This post was last modified: <date> by <user>.)" to the post date.
const modified = firstPost.find(".post_date .edited_post, .edited_post").first().text().replace(/\s+/g, " ").trim()
  || (firstPost.find(".post_date").first().text().match(/last modified:[^)]*/i)?.[0] ?? "").trim();

// MyBB renders [b]/[i]/[u]/[size] as styled spans; turn the ones that carry
// meaning into tags, since the sanitizer below drops all inline styles.
body.find("script, style, noscript, .spoiler_button, .spoiler_header button").remove();
body.find(".mycode_b, span[style*='font-weight: bold']").each((_, el) => { el.tagName = "strong"; });
body.find(".mycode_i, span[style*='font-style: italic']").each((_, el) => { el.tagName = "em"; });
body.find(".mycode_u, span[style*='text-decoration: underline']").each((_, el) => { el.tagName = "u"; });
body.find(".mycode_size, span[style*='font-size']").each((_, el) => {
  const size = $(el).attr("style") || "";
  if (/large|\b(1[6-9]|[2-9]\d)pt|\b(2[0-9]|[3-9]\d)px/.test(size)) $(el).attr("class", "wbo-lg");
});

// The thread's own template leans on a handful of structural classes for
// its callout boxes (flex-table/cell-heading/cell-body), legal/illegal
// example galleries (rules-fig-container/rules-fig), and tag pills
// (rules-tag) — keep exactly those (plus heading ids, for its in-page
// anchor links) so the site's own CSS can style them instead of every
// section collapsing into undifferentiated paragraphs.
const STRUCTURAL_DIV_CLASSES = [
  "flex-table", "flex-table-row", "flex-table-cell", "attention", "small", "finishes",
  "cell-heading", "cell-body", "battle-type-cell", "pre-table",
  "rules-fig-container", "ok", "ng", "rules-fig-heading", "rules-fig-content",
  "row", "rules-fig",
];
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"];

const html = sanitizeHtml(body.html() || "", {
  allowedTags: [
    "p", "br", "hr", "strong", "b", "em", "i", "u", "span", "div", "blockquote",
    "ul", "ol", "li", ...HEADING_TAGS,
    "table", "thead", "tbody", "tr", "th", "td", "a", "img", "cite",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "loading", "class"],
    span: ["class"],
    div: ["class"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    ...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, ["id"]])),
  },
  allowedClasses: {
    span: ["wbo-lg", "rules-tag"],
    div: STRUCTURAL_DIV_CLASSES,
    img: ["wbo-deck", "1on1", "3on3"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // relative forum links/images -> absolute, external links open in a new
  // tab; in-page anchors (the thread's own TOC links to its heading ids)
  // stay as plain fragments so they jump within our own page instead.
  transformTags: {
    a: (tagName, attribs) => {
      if (attribs.href?.startsWith("#")) return { tagName, attribs };
      return {
        tagName,
        attribs: {
          ...attribs,
          href: attribs.href ? new URL(attribs.href, SOURCE_URL).href : SOURCE_URL,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      };
    },
    img: (tagName, attribs) => {
      const absolute = new URL(attribs.src || "", SOURCE_URL);
      const name = basename(absolute.pathname);
      let src = absolute.href;
      if (localImageNames.has(name)) {
        copyFileSync(new URL(name, localImagesDir), new URL(name, IMAGES_DIR));
        src = `wbo-rules-images/${name}`;
      }
      return { tagName, attribs: { ...attribs, src, loading: "lazy" } };
    },
  },
  allowedSchemesAppliedToAttributes: ["href", "src"],
})
  // the forum pads nearly every heading/section with a spacer <br>; our own
  // CSS margins already provide that spacing, so drop the redundant ones
  .replace(/(<\/h[1-6]>)\s*(<br \/>\s*)+/g, "$1")
  .replace(/(<br \/>\s*){3,}/g, "<br /><br />")
  .trim();

const textLength = cheerio.load(html).text().replace(/\s+/g, " ").trim().length;
if (textLength < MIN_TEXT_LENGTH) fail(`rules text is only ${textLength} chars — refusing to overwrite with a probable error page`);

const hash = createHash("sha256").update(html).digest("hex").slice(0, 16);
let previous = null;
try {
  previous = JSON.parse(await readFile(OUT_FILE, "utf8"));
} catch {
  // first run — no existing copy
}
if (previous?.hash === hash) {
  console.log(`sync-wbo-rules: unchanged (${hash})`);
  process.exit(0);
}

await writeFile(
  OUT_FILE,
  JSON.stringify(
    {
      source: SOURCE_URL,
      title,
      lastModified: modified || null,
      syncedAt: new Date().toISOString(),
      hash,
      html,
    },
    null,
    2
  ) + "\n"
);
console.log(`sync-wbo-rules: updated (${previous?.hash ?? "none"} -> ${hash}, ${textLength} chars)`);
