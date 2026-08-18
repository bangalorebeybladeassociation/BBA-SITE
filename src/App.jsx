import React, { useState, useEffect, useRef, useCallback } from "react";
import Lenis from "lenis";
import beybladeImg from "./assets/beyblade.png";
import bbaLogo from "./assets/bba-logo.png";
import { useAuth } from "./auth/context";
import AuthPage from "./pages/AuthPage";
import AccountMenu from "./components/AccountMenu";
import Icon from "./components/Icon";
import { readAuthRoute, goAuth, leaveAuth, ROUTE_EVENT } from "./lib/authRoute";
import { readPage, leavePage, PAGE_EVENT } from "./lib/pageRoute";
import { firebaseReady } from "./lib/firebase";
import {
  listenEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listenSeason,
  setSeason,
  listenMemberCount,
  syncMemberCount,
  listenRulebook,
  setRulebook,
  listenInstagramPosts,
  addInstagramPost,
  deleteInstagramPost,
  listenApprovedProducts,
  listenSellerProducts,
  listenAllProducts,
  createProduct,
  decideProduct,
  listenUserProfile,
  setUserRole,
  setUserBlocked,
  deleteUserProfile,
  setUserPaymentInfo,
  listenAllUsers,
  createOrdersForCart,
  listenMyOrders,
  listenSellerOrders,
  setOrderStatus,
  createRegistration,
  listenAllRegistrations,
  setRegistrationStatus,
  deleteRegistration,
} from "./lib/firestore";

/* ---------------------------------------------------------
   BANGALORE BEYBLADE ASSOCIATION — tournament hub + shop
   Design tokens are CSS custom properties (see the THEME_VARS
   block below) so the whole app can flip between dark and light
   via a single [data-theme] attribute on the root element.
   Brand accents (--accent teal, --accent2 orange) and medal/rank
   colors stay constant across themes; only the neutral surface,
   border and text ramp inverts.
--------------------------------------------------------- */

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap');";

const EASE = "cubic-bezier(0.32,0.72,0,1)"; // iOS-ish spring ease

/* ---------- tiny scroll-reveal hook ---------- */
function useReveal() {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, shown] = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 700ms ${EASE} ${delay}ms, transform 700ms ${EASE} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- count-up, driven by the same reveal trigger ---------- */
function useCountUp(target, start, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);
  return value;
}

/* ---------- stat card — reveals in, then counts its number up ---------- */
function StatCard({ value, label, delay = 0 }) {
  const [ref, shown] = useReveal();
  const match = value.match(/^(\d+)(.*)$/);
  const numeric = match ? parseInt(match[1], 10) : null;
  const suffix = match ? match[2] : "";
  const count = useCountUp(numeric ?? 0, shown);
  return (
    <div
      ref={ref}
      className="lift p-5 rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 700ms ${EASE} ${delay}ms, transform 700ms ${EASE} ${delay}ms`,
      }}
    >
      <div className="disp font-bold" style={{ fontSize: 34, color: "var(--accent-ink)" }}>
        {numeric !== null ? count : value}{suffix}
      </div>
      <div className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}

/* ---------- spinning bey (signature element) ----------
   `speed` is seconds per full rotation. Alt text defaults to
   empty since most instances are decorative.                */
function SpinningBey({ size = 240, speed = 4, className = "", alt = "" }) {
  return (
    <div className={className} style={{ position: "relative", width: size, height: size }}>
      {/* stadium glow — sits under the bey and does not rotate with it */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-10%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,68,37,0.26) 0%, rgba(255,194,64,0.12) 45%, transparent 70%)",
        }}
      />
      <img
        src={beybladeImg}
        alt={alt}
        draggable="false"
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          height: "100%",
          animation: `blade-spin ${speed}s linear infinite`,
          filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.55))",
        }}
      />
    </div>
  );
}

/* ---------- rank ring for leaderboard ---------- */
// Standard competition ranking: equal points share the same rank (e.g.
// 1,2,3,3,5 — not 1,2,3,3,4), and every row that shares its rank with
// another is flagged so the UI can mark it as a tie.
function rankLeaderboard(rows) {
  let rank = 0;
  const ranked = rows.map((row, i) => {
    if (i === 0 || row.points !== rows[i - 1].points) rank = i + 1;
    return { ...row, rank };
  });
  const countByRank = new Map();
  ranked.forEach((row) => countByRank.set(row.rank, (countByRank.get(row.rank) || 0) + 1));
  return ranked.map((row) => ({ ...row, tied: countByRank.get(row.rank) > 1 }));
}

// The most recently-added event (last column found in the sheet) is always
// picked out in gold — everything earlier reads as a uniform violet — so
// the dots double as "how far into the season is this."
const EVENT_DOT_COLOR = "#9B7EF0";

function EventDots({ eventDefs, events, size = 7 }) {
  if (!eventDefs.length) return null;
  const lastKey = eventDefs[eventDefs.length - 1]?.key;
  return (
    <div className="flex items-center gap-1 shrink-0">
      {eventDefs.map((ev) => {
        const filled = !!events?.[ev.key];
        const color = ev.key === lastKey ? "var(--gold)" : EVENT_DOT_COLOR;
        return (
          <span
            key={ev.key}
            title={ev.label}
            className="rounded-full shrink-0"
            style={{
              width: size,
              height: size,
              background: filled ? color : "transparent",
              border: `1.5px solid ${filled ? color : "var(--border-strong)"}`,
            }}
          />
        );
      })}
    </div>
  );
}

function EventLegend({ eventDefs }) {
  if (!eventDefs.length) return null;
  const lastKey = eventDefs[eventDefs.length - 1]?.key;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
      {eventDefs.map((ev) => (
        <div key={ev.key} className="flex items-center gap-1.5">
          <span
            className="rounded-full shrink-0"
            style={{ width: 7, height: 7, background: ev.key === lastKey ? "var(--gold)" : EVENT_DOT_COLOR }}
          />
          <span>{ev.short} — {ev.label}</span>
        </div>
      ))}
    </div>
  );
}

// Soft blurred color blobs sitting behind the glass panels — frosted glass
// only reads as "glass" when there's something varied behind it to
// refract, a flat single-tone background makes backdrop-blur invisible.
function GlassBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
      <div style={{ position: "absolute", top: "-10%", left: "0%", width: 420, height: 420, borderRadius: "50%", background: "var(--accent)", opacity: 0.16, filter: "blur(90px)" }} />
      <div style={{ position: "absolute", top: "10%", right: "0%", width: 380, height: 380, borderRadius: "50%", background: "var(--gold)", opacity: 0.14, filter: "blur(90px)" }} />
      <div style={{ position: "absolute", bottom: "-5%", left: "30%", width: 340, height: 340, borderRadius: "50%", background: "var(--accent2)", opacity: 0.1, filter: "blur(90px)" }} />
    </div>
  );
}

function PodiumCard({ row, rank, eventDefs, featured }) {
  const ringColor = rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : "var(--bronze)";
  return (
    <div
      className={`glass${featured ? "-strong" : ""} rounded-3xl p-6 flex flex-col items-center text-center relative ${featured ? "order-first sm:order-none" : ""}`}
      style={featured ? { boxShadow: "0 12px 40px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight), 0 0 60px rgba(255,194,64,0.18)" } : undefined}
    >
      <div
        className="rounded-full flex items-center justify-center font-bold mb-3"
        style={{
          width: featured ? 56 : 44,
          height: featured ? 56 : 44,
          border: `2px solid ${ringColor}`,
          color: ringColor,
          fontSize: featured ? 22 : 16,
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {rank}
      </div>
      <div className="font-semibold mb-1 truncate max-w-full" style={{ fontSize: featured ? 18 : 15 }}>{row.name}</div>
      <div className="disp font-bold mb-3" style={{ fontSize: featured ? 34 : 26, color: ringColor }}>
        {row.points}<span className="text-sm font-normal ml-1" style={{ color: "var(--text-faint)" }}>pts</span>
      </div>
      <EventDots eventDefs={eventDefs} events={row.events} />
    </div>
  );
}

function StandingsRow({ row, maxPoints, eventDefs, delay }) {
  const pct = maxPoints > 0 ? Math.max(4, (row.points / maxPoints) * 100) : 0;
  // Ties are only called out within the top 10 — below that they're common
  // enough (a 47-blader season) that flagging every one just adds noise;
  // the rank numbers stay mathematically correct either way.
  const showTie = row.tied && row.rank <= 10;
  return (
    <Reveal delay={delay}>
      <div className="flex items-center gap-3 sm:gap-4 py-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
        <span className="text-sm w-9 sm:w-10 shrink-0 whitespace-nowrap" style={{ color: "var(--text-faint)", fontFamily: "'JetBrains Mono',monospace" }}>
          {showTie ? `T-${row.rank}` : row.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="font-semibold text-sm truncate">{row.name}</span>
            {showTie && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
              >
                TIE
              </span>
            )}
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 5, background: "var(--glass-border)" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${EVENT_DOT_COLOR}, var(--gold))`, borderRadius: 999 }} />
          </div>
        </div>
        <EventDots eventDefs={eventDefs} events={row.events} />
        <span className="text-sm font-bold w-10 sm:w-12 text-right shrink-0" style={{ color: "var(--gold)", fontFamily: "'JetBrains Mono',monospace" }}>
          {row.points}
        </span>
      </div>
    </Reveal>
  );
}

const LEADERBOARD_TOP_COUNT = 3;
const LEADERBOARD_COLLAPSED_REST = 7; // + the 3 podium rows = 10 visible by default

function LeaderboardSection({ rows, eventDefs, season }) {
  const [expanded, setExpanded] = useState(false);
  const ranked = rankLeaderboard(rows);
  const topThree = ranked.slice(0, LEADERBOARD_TOP_COUNT);
  const rest = ranked.slice(LEADERBOARD_TOP_COUNT);
  const shownRest = expanded ? rest : rest.slice(0, LEADERBOARD_COLLAPSED_REST);
  const hasMore = rest.length > shownRest.length;
  const maxPoints = ranked[0]?.points || 1;
  const lastEvent = eventDefs[eventDefs.length - 1];

  return (
    <div className="relative px-4 py-8 sm:px-8 sm:py-10 rounded-[32px] overflow-hidden">
      <GlassBackdrop />
      <div className="relative" style={{ zIndex: 1 }}>
        <Reveal>
          <h2 className="disp font-bold text-3xl text-center mb-2">Season {season} Leaderboard</h2>
          <p className="text-center mb-10" style={{ color: "var(--text-dim)" }}>
            {eventDefs.length > 0
              ? `Cumulative points across ${eventDefs.length} events — ranked through ${lastEvent ? lastEvent.label : "the latest event"}.`
              : "Points from all sanctioned Bangalore events, merged by ranking."}
          </p>
        </Reveal>

        {topThree.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch mb-10">
            {topThree[1] && <PodiumCard row={topThree[1]} rank={2} eventDefs={eventDefs} />}
            {topThree[0] && <PodiumCard row={topThree[0]} rank={1} eventDefs={eventDefs} featured />}
            {topThree[2] && <PodiumCard row={topThree[2]} rank={3} eventDefs={eventDefs} />}
          </div>
        )}

        {rest.length > 0 && (
          <>
            <p className="text-xs mb-4" style={{ color: "var(--text-faint)" }}>
              Ranked by total points. Bladers with equal totals share a place — the next rank skips to reflect
              it. Ties are only marked with a TIE badge within the top 10.
            </p>
            <div className="glass rounded-3xl px-4 sm:px-5">
              {shownRest.map((row, i) => (
                <StandingsRow key={row.id} row={row} maxPoints={maxPoints} eventDefs={eventDefs} delay={i * 40} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setExpanded(true)}
                className="tap glass w-full mt-4 py-3 rounded-full text-sm font-semibold"
                style={{ color: "var(--text)" }}
              >
                Show all {ranked.length} bladers
              </button>
            )}
          </>
        )}

        {eventDefs.length > 0 && (
          <div className="mt-10 pt-6 flex justify-center" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <EventLegend eventDefs={eventDefs} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- toast ---------- */
function useToast() {
  const [toast, setToast] = useState(null);
  const fire = useCallback((msg) => {
    setToast(msg);
    window.clearTimeout(fire._t);
    fire._t = window.setTimeout(() => setToast(null), 2400);
  }, []);
  return [toast, fire];
}

/* ---------- live Firestore data hooks ----------
   Public collections (events/leaderboard/rulebook) are always
   subscribed — they're readable signed out. Role-scoped
   collections (products/orders) only subscribe once the
   relevant uid/permission is available, since firestore.rules
   rejects unfiltered queries from anyone but an admin.        */
function useEvents() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenEvents(setEvents);
  }, []);
  // Firestore returns these in whatever order they were created, not
  // chronological — sort latest date first so the timeline reads in order.
  return [...events].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Leaderboard is read live from the club's Google Sheet, not entered by
// hand in the app — the sheet already is the source of truth the club
// actually maintains, and every extra layer of manual re-entry (paste
// tools, migrated baselines) was just another place for the numbers to
// drift from it. The sheet must be shared as "Anyone with the link can
// view" for its published-CSV export to be fetchable without auth.
const LEADERBOARD_SHEET_ID = "1--ZTE0vVe4G_aTW5ok7ugEzlrVJrJbjEVIKjAaY6CQ0";
const LEADERBOARD_SHEET_GID = "0";
const LEADERBOARD_SHEET_URL = `https://docs.google.com/spreadsheets/d/${LEADERBOARD_SHEET_ID}/edit?gid=${LEADERBOARD_SHEET_GID}`;

// Minimal CSV row parser (handles quoted fields with embedded commas) —
// enough for a plain export, no need to pull in a CSV library for this.
function parseCsvRow(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cells.push(cur); cur = ""; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}

// Every event is a pair of columns (a score column + an attendance column)
// sitting between "Blader Name" and "TOTAL" — so instead of matching a
// fixed list of event names, this just walks that range two columns at a
// time and reads each event's own name straight off its first column's
// header ("Inferno Game Points" -> "Inferno", "Blade Requiem Points" ->
// "Blade Requiem"). Add a new event to the sheet in the same two-column
// style and it's picked up automatically, no code change needed. This
// only drives the decorative per-event dots — the actual points/ranking
// always come from the TOTAL column, so a header that doesn't fit the
// pattern just means that one event's dot never lights up, never a wrong
// score.
function findEventColumns(rawHeader, bladerIdx, totalIdx) {
  const defs = [];
  for (let i = bladerIdx + 1; i + 1 < totalIdx; i += 2) {
    const rawLabel = (rawHeader[i] || "").trim();
    if (!rawLabel) continue;
    const label =
      rawLabel
        .replace(/\s*game\s*points\s*$/i, "")
        .replace(/\s*points\s*$/i, "")
        .replace(/\s*game\s*$/i, "")
        .trim() || rawLabel;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `event-${i}`;
    defs.push({ key, label, short: label.charAt(0).toUpperCase() || "?", idx: i });
  }
  return defs;
}

// Only the Blader Name and TOTAL columns feed the actual points/ranking —
// the sheet's own TOTAL is trusted as-is rather than re-derived from the
// per-event columns, so that can't drift from what's visually in the
// spreadsheet. The per-event columns are read separately, only to light up
// participation dots.
async function fetchSheetLeaderboard() {
  const url = `https://docs.google.com/spreadsheets/d/${LEADERBOARD_SHEET_ID}/export?format=csv&gid=${LEADERBOARD_SHEET_GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], eventDefs: [] };
  const rawHeader = parseCsvRow(lines[0]).map((h) => h.trim());
  const header = rawHeader.map((h) => h.toLowerCase());
  const bladerIdx = header.findIndex((h) => h.includes("blader"));
  const totalIdx = header.findIndex((h) => h === "total" || h.includes("total"));
  if (bladerIdx === -1 || totalIdx === -1) return { rows: [], eventDefs: [] };
  const eventCols = findEventColumns(rawHeader, bladerIdx, totalIdx);
  const num = (s) => parseInt((s || "").trim(), 10) || 0;
  const rows = lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvRow(line);
      const name = (cols[bladerIdx] || "").trim();
      const points = num(cols[totalIdx]);
      const events = {};
      eventCols.forEach((ev) => {
        events[ev.key] = num(cols[ev.idx]) + num(cols[ev.idx + 1]) > 0;
      });
      return { name, points, events };
    })
    .filter((r) => r.name && r.points > 0)
    .sort((a, b) => b.points - a.points);
  return { rows, eventDefs: eventCols.map(({ key, label, short }) => ({ key, label, short })) };
}

const SHEET_REFRESH_MS = 5 * 60 * 1000;

function useLiveLeaderboard() {
  const [rows, setRows] = useState([]);
  const [eventDefs, setEventDefs] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [lastSynced, setLastSynced] = useState(null);

  const refresh = useCallback(async () => {
    setStatus((s) => (s === "ok" ? "refreshing" : "loading"));
    try {
      const { rows: data, eventDefs: defs } = await fetchSheetLeaderboard();
      setRows(data.map((r, i) => ({ id: `sheet-${i}`, name: r.name, region: "", points: r.points, events: r.events })));
      setEventDefs(defs);
      setStatus("ok");
      setLastSynced(new Date());
    } catch (err) {
      console.error("fetchSheetLeaderboard failed", err);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, SHEET_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { rows, eventDefs, status, lastSynced, refresh };
}

function useSeason() {
  const [season, setSeasonState] = useState(1);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenSeason(setSeasonState);
  }, []);
  return season;
}

function useMemberCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenMemberCount(setCount);
  }, []);
  return count;
}

function useRulebookText() {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!firebaseReady) return;
    return listenRulebook(setText);
  }, []);
  return text;
}

function useInstagramPosts() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenInstagramPosts(setPosts);
  }, []);
  return posts;
}

// Extracts the shortcode from any Instagram post/reel URL and returns the
// public no-auth embed iframe src for it, or null if it doesn't look like
// a valid Instagram post URL.
function instagramEmbedSrc(url) {
  const match = url.match(/instagram\.com\/(p|reel)\/([^/?]+)/);
  return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed` : null;
}

function useApprovedProducts() {
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!firebaseReady) {
      setLoaded(true);
      return;
    }
    return listenApprovedProducts((list) => {
      setProducts(list);
      setLoaded(true);
    });
  }, []);
  return [products, loaded];
}

function useSellerProducts(uid) {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    if (!uid) {
      setProducts([]);
      return;
    }
    return listenSellerProducts(uid, setProducts);
  }, [uid]);
  return products;
}

function useAllProducts(enabled) {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setProducts([]);
      return;
    }
    return listenAllProducts(setProducts);
  }, [enabled]);
  return products;
}

function useAllUsers(enabled) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      return;
    }
    return listenAllUsers(setUsers);
  }, [enabled]);
  return users;
}

function useAllRegistrations(enabled) {
  const [registrations, setRegistrations] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setRegistrations([]);
      return;
    }
    return listenAllRegistrations(setRegistrations);
  }, [enabled]);
  return registrations;
}

function useMyProfile(uid) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    return listenUserProfile(uid, setProfile);
  }, [uid]);
  return profile;
}

function useMyOrders(uid) {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!uid) {
      setOrders([]);
      return;
    }
    return listenMyOrders(uid, setOrders);
  }, [uid]);
  return orders;
}

function useSellerOrders(uid, enabled) {
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    if (!uid || !enabled) {
      setOrders([]);
      return;
    }
    return listenSellerOrders(uid, setOrders);
  }, [uid, enabled]);
  return orders;
}

/* ================= DATA ================= */

// Product taxonomy: what kind of item, its condition, and — only for
// Beyblades themselves — the gameplay archetype.
const ITEM_TYPES = ["Beyblade", "Stadium", "Launcher", "Parts"];
const CONDITIONS = ["NIB", "NIP", "Used"];
const BEYBLADE_CATEGORIES = ["Attack", "Defense", "Balance", "Stamina"];

/* ================= APP ================= */

// Dark is the site's home theme; light is opt-in and remembered per device.
// Applied as a `data-theme` attribute on <html> so the CSS variables defined
// in the global <style> block (see :root / :root[data-theme="light"]) cascade
// to every inline style in the app without threading theme through props.
const THEME_KEY = "bba-theme";
function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // private browsing / storage disabled — theme just won't persist
    }
  }, [theme]);
  return [theme, setTheme];
}

// Buttery inertia scrolling (Lenis), plus a couple of beyblade-themed
// touches riding on its scroll events: the hero bey tilts with scroll
// velocity like it's being flicked, and a small spinning bey doubles as a
// scroll-progress indicator / back-to-top control. Both are driven by
// direct ref mutation rather than React state — re-rendering this whole
// component on every animation frame would fight the smoothness we're
// adding in the first place.
function useSmoothScroll() {
  const lenisRef = useRef(null);
  const heroTiltRef = useRef(null);
  const scrollBeyRef = useRef(null);
  const backToTopRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
      autoRaf: true,
      anchors: { offset: -72 }, // clears the fixed nav bar
    });
    lenisRef.current = lenis;

    lenis.on("scroll", (l) => {
      if (heroTiltRef.current) {
        const tilt = Math.max(-24, Math.min(24, l.velocity * 6));
        heroTiltRef.current.style.transform = `rotate(${tilt}deg)`;
      }
      if (scrollBeyRef.current) {
        scrollBeyRef.current.style.transform = `rotate(${l.progress * 1080}deg)`;
      }
      if (backToTopRef.current) {
        const visible = l.progress > 0.06;
        backToTopRef.current.style.opacity = visible ? "1" : "0";
        backToTopRef.current.style.pointerEvents = visible ? "auto" : "none";
      }
    });

    // "#top" (the logo link) has no matching element by design — browsers
    // scroll-to-top for it by convention, which Lenis's built-in anchor
    // handling doesn't know to special-case, so it's wired up separately.
    const onClickTop = (e) => {
      if (!e.target.closest('a[href="#top"]')) return;
      e.preventDefault();
      lenis.scrollTo(0);
    };
    document.addEventListener("click", onClickTop);

    return () => {
      document.removeEventListener("click", onClickTop);
      lenis.destroy();
    };
  }, []);

  return { lenisRef, heroTiltRef, scrollBeyRef, backToTopRef };
}

export default function App() {
  const { lenisRef, heroTiltRef, scrollBeyRef, backToTopRef } = useSmoothScroll();
  const [theme, setTheme] = useTheme();
  const [nav, setNav] = useState(false);
  const [toast, fireToast] = useToast();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [registerEvent, setRegisterEvent] = useState(null);

  const { user, loading: authLoading, isAdmin, isSeller, blockedNotice, clearBlockedNotice } = useAuth();
  const [route, setRoute] = useState(readAuthRoute);
  const [page, setPage] = useState(readPage);

  const events = useEvents();
  const { rows: sheetRows, eventDefs: leaderboardEventDefs, status: sheetStatus, lastSynced: sheetSynced, refresh: refreshSheet } = useLiveLeaderboard();
  const season = useSeason();
  const leaderboard = sheetRows.map((r) => ({ ...r, season }));
  const memberCount = useMemberCount();
  const rulebookText = useRulebookText();
  const instagramPosts = useInstagramPosts();
  const myProfile = useMyProfile(user?.uid);

  const [approvedProducts, productsLoaded] = useApprovedProducts();
  const sellerProducts = useSellerProducts(isSeller ? user?.uid : null);
  const allProducts = useAllProducts(isAdmin);
  const allUsers = useAllUsers(isAdmin);
  const allRegistrations = useAllRegistrations(isAdmin);
  const myOrders = useMyOrders(user?.uid);
  const sellerOrders = useSellerOrders(user?.uid, isSeller);

  // Piggybacks on the admin-only user list an admin's browser already has
  // loaded, to keep the public "Registered bladers" stat honest without
  // exposing the users collection to public reads — see syncMemberCount.
  useEffect(() => {
    if (!isAdmin || allUsers.length === 0) return;
    syncMemberCount(allUsers.length).catch((err) => console.error("syncMemberCount failed", err));
  }, [isAdmin, allUsers.length]);

  useEffect(() => {
    const onScroll = () => setNav(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ?auth=login|signup drives the auth view. popstate covers back/forward,
  // ROUTE_EVENT covers our own pushState calls.
  useEffect(() => {
    const sync = () => setRoute(readAuthRoute());
    window.addEventListener("popstate", sync);
    window.addEventListener(ROUTE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(ROUTE_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (route.mode) window.scrollTo(0, 0);
  }, [route.mode]);

  // ?page=seller|admin drives the dedicated dashboard pages, reached from
  // the account menu rather than an inline tab switcher.
  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener("popstate", sync);
    window.addEventListener(PAGE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(PAGE_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (page) window.scrollTo(0, 0);
  }, [page]);

  // Bounce back to the site if the URL points at a dashboard this account
  // isn't (or is no longer) authorized for — e.g. an admin revoked access
  // while the tab was open.
  useEffect(() => {
    if (authLoading) return;
    if (page === "seller" && !isSeller) leavePage();
    if (page === "admin" && !isAdmin) leavePage();
  }, [page, authLoading, isSeller, isAdmin]);

  /* Landing on an auth route with a session means sign-in just succeeded —
     either from this page, or from a Google redirect that reloaded us back
     here. Same exit either way, honouring ?next=. */
  useEffect(() => {
    if (authLoading || !user || !route.mode) return;
    const { next } = route;
    leaveAuth();
    fireToast(`Signed in as ${user.name}`);
    if (next === "cart") setCartOpen(true);
    if (next === "market") {
      requestAnimationFrame(() =>
        document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })
      );
    }
  }, [authLoading, user, route, fireToast]);

  // An admin can block/unblock live — if this session's account gets
  // blocked, AuthProvider signs them out and flags it here.
  useEffect(() => {
    if (!blockedNotice) return;
    fireToast("Your account has been blocked. Contact an admin.");
    clearBlockedNotice();
  }, [blockedNotice, clearBlockedNotice, fireToast]);

  const addToCart = (p) => {
    setCart((c) => {
      const found = c.find((x) => x.id === p.id);
      if (found) return c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { ...p, qty: 1 }];
    });
    fireToast(`Added "${p.name}" to cart`);
  };

  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const checkout = async () => {
    if (!cart.length) return;
    if (!user) {
      setCartOpen(false);
      goAuth("login", "cart");
      return;
    }
    try {
      const orders = await createOrdersForCart(cart, user);
      setCart([]);
      setCartOpen(false);
      setCheckoutResult(orders);
    } catch (e) {
      fireToast("Couldn't place order — please try again");
    }
  };

  const openRegistration = (event) => {
    if (!user) {
      fireToast("Sign in to register for this event");
      goAuth("login");
      return;
    }
    setRegisterEvent(event);
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        :root {
          --bg: #0A0D18;
          --bg-rgb: 10,13,24;
          --surface: #141827;
          --border: #1C2136;
          --border-strong: #2A3050;
          --text: #F4F2EC;
          --text-dim: #9AA1B4;
          --text-faint: #7A8194;
          --text-faint-2: #4A5070;
          --icon-dim: #5A6178;
          --accent: #00E6C3;
          --accent-ink: #00E6C3;
          --accent2: #FF4425;
          --accent2-ink: #FF4425;
          --gold: #FFC240;
          --silver: #C7CCDA;
          --bronze: #FF9354;
          --danger: #FF6B5A;
          --glass-bg: rgba(255,255,255,0.06);
          --glass-bg-strong: rgba(255,255,255,0.1);
          --glass-border: rgba(255,255,255,0.14);
          --glass-highlight: rgba(255,255,255,0.22);
          --glass-shadow: rgba(0,0,0,0.35);
        }
        :root[data-theme="light"] {
          --bg: #F5F6FA;
          --bg-rgb: 245,246,250;
          --surface: #FFFFFF;
          --border: #E3E6EF;
          --border-strong: #CBD0DE;
          --text: #14161F;
          --text-dim: #545A6E;
          --text-faint: #6B7182;
          --text-faint-2: #8A90A3;
          --icon-dim: #6B7182;
          --accent-ink: #00967F;
          --accent2-ink: #D8330F;
          --gold: #B8860B;
          --silver: #6B7280;
          --bronze: #E06A2E;
          --danger: #D8332A;
          --glass-bg: rgba(255,255,255,0.55);
          --glass-bg-strong: rgba(255,255,255,0.72);
          --glass-border: rgba(20,22,31,0.08);
          --glass-highlight: rgba(255,255,255,0.9);
          --glass-shadow: rgba(20,22,31,0.12);
        }
        @keyframes blade-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes bey-wobble { 0%,100% { transform: rotate(-22deg);} 50% { transform: rotate(22deg);} }
        @keyframes toast-in { from { opacity:0; transform: translate(-50%,12px);} to {opacity:1; transform: translate(-50%,0);} }
        @keyframes pop-in { from { opacity:0; transform: scale(0.7);} to {opacity:1; transform: scale(1);} }
        @keyframes auth-in { from { opacity:0; transform: translateY(14px);} to {opacity:1; transform: translateY(0);} }
        @keyframes glow-pulse { 0%,100% { opacity:0.5;} 50% { opacity:0.9;} }
        .disp { font-family:'Rajdhani',sans-serif; }
        .tap { transition: transform 200ms ${EASE}, opacity 150ms ${EASE}, filter 200ms ${EASE}; }
        .tap:active { transform: scale(0.96); opacity:0.85; }
        .lift { transition: transform 260ms ${EASE}, box-shadow 260ms ${EASE}, border-color 260ms ${EASE}; }
        .glass {
          background: var(--glass-bg);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          backdrop-filter: blur(24px) saturate(160%);
          border: 1px solid var(--glass-border);
          box-shadow: 0 8px 32px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight);
        }
        .glass-strong {
          background: var(--glass-bg-strong);
          -webkit-backdrop-filter: blur(28px) saturate(170%);
          backdrop-filter: blur(28px) saturate(170%);
          border: 1px solid var(--glass-border);
          box-shadow: 0 12px 40px var(--glass-shadow), inset 0 1px 0 var(--glass-highlight);
        }
        .field-input { transition: border-color 200ms ${EASE}, box-shadow 200ms ${EASE}, transform 150ms ${EASE}; }
        .field-input:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,230,195,0.16); }
        .field-input:focus-within { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,230,195,0.16); }
        .swatch { transition: transform 180ms ${EASE}, box-shadow 180ms ${EASE}; }
        .swatch:hover { transform: scale(1.15); }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0.7; }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
        .nav-link { position: relative; padding-bottom: 2px; }
        .nav-link::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 2px;
          background: var(--accent); border-radius: 1px; transform: scaleX(0); transform-origin: center;
          transition: transform 280ms ${EASE};
        }
        @media (hover: hover) {
          .tap:hover { filter: brightness(1.1); }
          .lift:hover { transform: translateY(-4px); box-shadow: 0 16px 30px rgba(0,0,0,0.35); border-color: var(--border-strong) !important; }
          .nav-link:hover::after { transform: scaleX(1); }
        }
        ::selection { background:var(--accent2); color:#0A0D18; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      {/* AUTH VIEW / DASHBOARD PAGES — each replaces the site, but stays
          inside this wrapper so the font import, .disp/.tap classes and
          keyframes above still apply. */}
      {route.mode ? (
        <AuthPage mode={route.mode} next={route.next} onClose={leaveAuth} />
      ) : page === "seller" && isSeller ? (
        <DashboardPage
          icon="seller"
          title="Seller Dashboard"
          subtitle="Manage your listings, sales, and payment info."
          onBack={leavePage}
        >
          <SellerPanel
            seller={user}
            profile={myProfile}
            products={sellerProducts}
            orders={sellerOrders}
            onCreate={async (p) => {
              await createProduct(p);
              fireToast("Listing submitted for admin approval");
            }}
            onSavePaymentInfo={async (info) => {
              await setUserPaymentInfo(user.uid, info);
              fireToast("Payment info saved");
            }}
            onMarkPaid={async (orderId) => {
              await setOrderStatus(orderId, "paid");
              fireToast("Order marked as paid");
            }}
          />
        </DashboardPage>
      ) : page === "admin" && isAdmin ? (
        <DashboardPage
          icon="admin"
          title="Admin Dashboard"
          subtitle="Manage roles, listings, events, the leaderboard, and the rulebook."
          onBack={leavePage}
        >
          <AdminPanel
            products={allProducts}
            onDecide={async (id, status) => {
              await decideProduct(id, status);
              fireToast(status === "approved" ? "Listing approved" : "Listing rejected");
            }}
            events={events}
            leaderboard={leaderboard}
            sheetStatus={sheetStatus}
            sheetSynced={sheetSynced}
            onRefreshSheet={refreshSheet}
            season={season}
            onChangeSeason={async (n) => {
              await setSeason(n);
              fireToast(`Now on Season ${n}`);
            }}
            rulebookText={rulebookText}
            fireToast={fireToast}
            users={allUsers}
            registrations={allRegistrations}
            onSetRegistrationStatus={async (id, status) => {
              await setRegistrationStatus(id, status);
              fireToast(status === "confirmed" ? "Payment confirmed" : "Registration updated");
            }}
            onDeleteRegistration={async (id) => {
              await deleteRegistration(id);
              fireToast("Registration deleted");
            }}
            instagramPosts={instagramPosts}
          />
        </DashboardPage>
      ) : registerEvent ? (
        <RegistrationPage
          event={registerEvent}
          user={user}
          fireToast={fireToast}
          onClose={() => setRegisterEvent(null)}
        />
      ) : (
      <>

      {/* NAV */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 px-5 md:px-10 flex items-center justify-between"
        style={{
          height: 64,
          background: nav ? "rgba(var(--bg-rgb), 0.85)" : "transparent",
          backdropFilter: nav ? "blur(14px)" : "none",
          borderBottom: nav ? "1px solid var(--border)" : "1px solid transparent",
          transition: `all 400ms ${EASE}`,
        }}
      >
        <a href="#top" className="tap flex items-center gap-2.5">
          <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            <img src={bbaLogo} alt="Bangalore Beyblade Association" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          {/* full name where there's room; the association's own BBA mark below that */}
          <span className="disp font-bold tracking-wide text-lg hidden lg:inline">
            BANGALORE BEYBLADE <span style={{ color: "var(--accent2-ink)" }}>ASSOCIATION</span>
          </span>
          <span className="disp font-bold tracking-wide text-lg lg:hidden">BBA</span>
        </a>
        <div className="hidden md:flex items-center gap-7 text-sm" style={{ color: "var(--silver)" }}>
          <a href="#events" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="events" /> Events
          </a>
          <a href="#media" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="media" /> Media
          </a>
          <a href="#leaderboard" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="leaderboard" /> Leaderboard
          </a>
          <a href="#rulebook" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="rulebook" /> Rulebook
          </a>
          <a href="#market" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="shop" /> Shop
          </a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="tap flex items-center justify-center rounded-full shrink-0"
            style={{ width: 38, height: 38, border: "1px solid var(--border-strong)", color: "var(--text)" }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          </button>
          <button
            onClick={() => setCartOpen(true)}
            className="tap relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "var(--accent2)", color: "#0A0D18" }}
          >
            <Icon name="cart" size={16} /> <span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="absolute -top-2 -right-2 rounded-full flex items-center justify-center"
                style={{
                  width: 20,
                  height: 20,
                  background: "var(--accent)",
                  color: "#0A0D18",
                  fontSize: 11,
                  fontWeight: 700,
                  animation: `pop-in 320ms ${EASE}`,
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
          <AccountMenu onSignedOut={() => fireToast("Signed out")} onOpenOrders={() => setOrdersOpen(true)} />
        </div>
      </nav>

      {/* HERO */}
      <header className="relative overflow-hidden px-5 md:px-10 pt-32 pb-24 flex flex-col md:flex-row items-center gap-10 max-w-6xl mx-auto">
        <div className="flex-1">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-5"
            style={{ background: "var(--border)", color: "var(--accent-ink)", letterSpacing: 1 }}
          >
            BANGALORE · SEASON {season} NOW LIVE
          </div>
          <h1 className="disp font-bold leading-[0.95]" style={{ fontSize: "clamp(2.6rem,6vw,4.6rem)" }}>
            WHERE BANGALORE'S<br />
            <span style={{ color: "var(--accent2-ink)" }}>BLADERS</span> COLLIDE.
          </h1>
          <p className="mt-5 max-w-md" style={{ color: "var(--text-dim)" }}>
            Tournament schedules, live brackets, match footage and a
            marketplace built for the city's Beyblade X community — organized
            by bladers, judged to WBO standard.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href={events[0]?.bracketUrl || "https://challonge.com/"}
              target="_blank"
              rel="noreferrer"
              className="tap px-6 py-3 rounded-full font-semibold text-sm"
              style={{ background: "var(--accent2)", color: "#0A0D18" }}
            >
              View Live Bracket ↗
            </a>
            <a
              href="#market"
              className="tap px-6 py-3 rounded-full font-semibold text-sm border"
              style={{ borderColor: "var(--border-strong)", color: "var(--text)" }}
            >
              Browse Marketplace
            </a>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <div ref={heroTiltRef} style={{ transition: `transform 400ms ${EASE}` }}>
            <SpinningBey size={280} alt="Beyblade X top spinning" />
          </div>
        </div>
      </header>

      {/* QUICK NAV — orients a first-time visitor to what's on this page */}
      <Reveal className="max-w-6xl mx-auto px-5 md:px-10 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["#events", "events", "Events", "Every event, past and upcoming, with live brackets"],
            ["#media", "media", "Media", "Photos and highlights from our Instagram"],
            ["#leaderboard", "leaderboard", "Leaderboard", `Season ${season} rankings across all events`],
            ["#market", "shop", "Shop", "Buy parts, or sell your own as an approved seller"],
          ].map(([href, icon, title, desc]) => (
            <a
              key={href}
              href={href}
              className="tap lift p-4 rounded-2xl block"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="disp font-semibold text-base flex items-center gap-2" style={{ color: "var(--accent-ink)" }}>
                <Icon name={icon} size={18} /> {title}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{desc}</div>
            </a>
          ))}
        </div>
      </Reveal>

      {/* STATS STRIP */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 grid grid-cols-1 sm:grid-cols-3 gap-6 pb-24">
        {[
          [String(events.length), "Tournaments hosted"],
          [String(memberCount), "Registered bladers"],
          ["1", "WBO-certified judge"],
        ].map(([n, l], i) => (
          <StatCard key={l} value={n} label={l} delay={i * 70} />
        ))}
      </div>

      {/* EVENTS */}
      <section id="events" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Tournament Events</h2>
          <p style={{ color: "var(--text-dim)" }} className="mb-2">Every event, past and upcoming — tap a bracket to open it live on Challonge.</p>
          <p className="text-xs mb-10" style={{ color: "var(--text-faint)" }}>New to brackets? Challonge is a free third-party tool that runs the live match tree — you don't need an account to view it, only to compete.</p>
        </Reveal>
        {events.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No events posted yet — check back soon.</p>
        ) : (
          <EventsTimeline events={events} onRegister={openRegistration} />
        )}
      </section>

      {/* MEDIA */}
      <section id="media" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <div className="flex items-end justify-between gap-3 flex-wrap mb-10">
            <div>
              <h2 className="disp font-bold text-3xl mb-2 flex items-center gap-2.5">
                <Icon name="gallery" size={26} /> Media
              </h2>
              <p style={{ color: "var(--text-dim)" }}>Photos and highlights from our Instagram.</p>
            </div>
            <a
              href="https://www.instagram.com/bangalore_beyblade_association/"
              target="_blank"
              rel="noreferrer"
              className="tap text-sm font-semibold"
              style={{ color: "var(--accent-ink)" }}
            >
              @bangalore_beyblade_association ↗
            </a>
          </div>
          {instagramPosts.length === 0 ? (
            <div className="p-8 rounded-2xl text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                Instagram gallery coming soon — follow us at{" "}
                <a
                  href="https://www.instagram.com/bangalore_beyblade_association/"
                  target="_blank"
                  rel="noreferrer"
                  className="tap font-semibold"
                  style={{ color: "var(--accent-ink)" }}
                >
                  @bangalore_beyblade_association
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {instagramPosts.map((post, i) => {
                const src = instagramEmbedSrc(post.url);
                if (!src) return null;
                return (
                  <Reveal key={post.id} delay={i * 60}>
                    <div
                      className="lift rounded-2xl overflow-hidden"
                      style={{ height: 460, border: "1px solid var(--border)" }}
                    >
                      <iframe
                        src={src}
                        title={`Instagram post ${i + 1}`}
                        loading="lazy"
                        scrolling="no"
                        style={{ width: "100%", height: 700, border: "none", marginTop: -1 }}
                      />
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* LEADERBOARD */}
      <section id="leaderboard" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        {leaderboard.length === 0 ? (
          <Reveal>
            <h2 className="disp font-bold text-3xl mb-2 text-center">Season {season} Leaderboard</h2>
            <p className="text-sm text-center" style={{ color: "var(--text-faint)" }}>No standings posted yet.</p>
          </Reveal>
        ) : (
          <LeaderboardSection rows={leaderboard} eventDefs={leaderboardEventDefs} season={season} />
        )}
      </section>

      {/* RULEBOOK */}
      <section id="rulebook" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Rulebook</h2>
          <p style={{ color: "var(--text-dim)" }} className="mb-10">Judged to WBO standard, with Bangalore-specific additions below.</p>
        </Reveal>
        <div className="p-6 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          {rulebookText ? (
            <p className="text-sm leading-relaxed" style={{ color: "var(--silver)", whiteSpace: "pre-wrap" }}>{rulebookText}</p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>The rulebook hasn't been published yet.</p>
          )}
        </div>
      </section>

      {/* MARKETPLACE — buying only. Selling/administering live on their own
          dashboard pages, reached from the account menu. */}
      <section id="market" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Marketplace</h2>
          <p style={{ color: "var(--text-dim)" }} className="mb-6">Buy parts from approved sellers across Bangalore's Beyblade X community.</p>
        </Reveal>
        {!user && (
          <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>
            <button onClick={() => goAuth("login", "market")} className="tap font-semibold" style={{ color: "var(--accent-ink)" }}>
              Sign in
            </button>{" "}
            to buy.
          </p>
        )}
        <div className="mt-6">
          <BuyerPanel products={approvedProducts} onAdd={addToCart} loaded={productsLoaded} />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 text-center text-xs py-10" style={{ color: "var(--text-faint-2)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", opacity: 0.85 }}>
          <img src={bbaLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <p>
          Bangalore Beyblade Association — run by bladers, for bladers. Not affiliated with TAKARA TOMY.
        </p>
      </footer>

      {/* CART DRAWER */}
      <div
        className="fixed inset-0 z-50"
        style={{
          pointerEvents: cartOpen ? "auto" : "none",
        }}
      >
        <div
          onClick={() => setCartOpen(false)}
          className="absolute inset-0"
          style={{
            background: "rgba(0,0,0,0.5)",
            opacity: cartOpen ? 1 : 0,
            transition: `opacity 350ms ${EASE}`,
            backdropFilter: "blur(2px)",
          }}
        />
        <div
          className="absolute right-0 top-0 h-full flex flex-col"
          style={{
            width: "min(380px,90vw)",
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            transform: cartOpen ? "translateX(0)" : "translateX(100%)",
            transition: `transform 420ms ${EASE}`,
          }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="disp font-semibold text-lg">Your Cart</h3>
            <button onClick={() => setCartOpen(false)} className="tap text-sm" style={{ color: "var(--text-dim)" }}>Close</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {cart.length === 0 && <p style={{ color: "var(--text-faint)" }} className="text-sm">Nothing here yet — add parts from the shop.</p>}
            {cart.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div style={{ color: "var(--text-faint)" }}>Qty {i.qty}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{i.price * i.qty}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex justify-between mb-3 text-sm">
              <span style={{ color: "var(--text-dim)" }}>Total</span>
              <span className="font-semibold" style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{cartTotal}</span>
            </div>
            {!user && cart.length > 0 && (
              <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
                Sign in to place your order — we need somewhere to send it.
              </p>
            )}
            <button
              onClick={checkout}
              className="tap w-full py-3 rounded-full font-semibold text-sm"
              style={{ background: "var(--accent2)", color: "#0A0D18" }}
            >
              {user ? "Checkout" : "Sign in to checkout"}
            </button>
          </div>
        </div>
      </div>

      {/* CHECKOUT CONFIRMATION — payment is a manual/UPI handoff, so this is
          where the buyer actually finds out how to pay each seller. */}
      {checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
          <div onClick={() => setCheckoutResult(null)} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
          <div className="relative w-full max-w-md rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="disp font-bold text-xl mb-1">Order placed</h3>
            <p className="text-sm mb-5" style={{ color: "var(--text-dim)" }}>
              Pay each seller directly, then they'll mark your order as paid.
            </p>
            <div className="space-y-3 mb-5">
              {checkoutResult.map((o) => (
                <div key={o.id} className="p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold">{o.sellerName}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{o.total}</span>
                  </div>
                  {o.sellerUpiId ? (
                    <p className="text-xs" style={{ color: "var(--accent-ink)" }}>UPI: {o.sellerUpiId}</p>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>No UPI on file —</p>
                  )}
                  {o.sellerPaymentContact && (
                    <p className="text-xs" style={{ color: "var(--text-dim)" }}>Contact: {o.sellerPaymentContact}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setCheckoutResult(null)}
              className="tap w-full py-2.5 rounded-full text-sm font-semibold"
              style={{ background: "var(--accent2)", color: "#0A0D18" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* MY ORDERS */}
      <div className="fixed inset-0 z-50" style={{ pointerEvents: ordersOpen ? "auto" : "none" }}>
        <div
          onClick={() => setOrdersOpen(false)}
          className="absolute inset-0"
          style={{
            background: "rgba(0,0,0,0.5)",
            opacity: ordersOpen ? 1 : 0,
            transition: `opacity 350ms ${EASE}`,
            backdropFilter: "blur(2px)",
          }}
        />
        <div
          className="absolute right-0 top-0 h-full flex flex-col"
          style={{
            width: "min(420px,90vw)",
            background: "var(--surface)",
            borderLeft: "1px solid var(--border)",
            transform: ordersOpen ? "translateX(0)" : "translateX(100%)",
            transition: `transform 420ms ${EASE}`,
          }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="disp font-semibold text-lg">My Orders</h3>
            <button onClick={() => setOrdersOpen(false)} className="tap text-sm" style={{ color: "var(--text-dim)" }}>Close</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {myOrders.length === 0 && <p style={{ color: "var(--text-faint)" }} className="text-sm">No orders yet.</p>}
            {myOrders.map((o) => (
              <div key={o.id} className="p-4 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{o.sellerName}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{o.total}</span>
                </div>
                <OrderStatusBadge status={o.status} />
                {o.status === "pending_payment" && o.sellerUpiId && (
                  <p className="text-xs mt-2" style={{ color: "var(--accent-ink)" }}>Pay via UPI: {o.sellerUpiId}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 px-5 py-3 rounded-full text-sm font-medium z-50"
          style={{
            background: "var(--border)",
            border: "1px solid var(--border-strong)",
            animation: `toast-in 300ms ${EASE}`,
          }}
        >
          {toast}
        </div>
      )}

      {/* back to top — doubles as a scroll-progress bey, rotation bound to
          how far down the page you are */}
      <button
        ref={backToTopRef}
        onClick={() => lenisRef.current?.scrollTo(0)}
        aria-label="Back to top"
        className="tap lift fixed z-40 flex items-center justify-center rounded-full"
        style={{
          right: 20,
          bottom: 20,
          width: 52,
          height: 52,
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          opacity: 0,
          pointerEvents: "none",
          transition: `opacity 300ms ${EASE}`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        <img
          ref={scrollBeyRef}
          src={beybladeImg}
          alt=""
          draggable="false"
          style={{ width: 30, height: 30, display: "block" }}
        />
      </button>
    </div>
  );
}

/* ---------- dashboard page shell ----------
   Full-page replacement for the Seller/Admin dashboards, same
   pattern as AuthPage — reached from the account menu rather
   than an inline tab switcher within the site.                */
function DashboardPage({ icon, title, subtitle, onBack, children }) {
  return (
    <div
      className="min-h-screen px-5 md:px-10 py-10 max-w-5xl mx-auto"
      style={{ animation: `auth-in 380ms ${EASE}` }}
    >
      <button onClick={onBack} className="tap text-sm mb-6 inline-block" style={{ color: "var(--text-faint)" }}>
        ← Back to site
      </button>
      <h1 className="disp font-bold text-3xl mb-1 flex items-center gap-2.5">
        {icon && (
          <span
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 34, height: 34, background: "#00E6C31A", color: "var(--accent-ink)" }}
          >
            <Icon name={icon} size={18} />
          </span>
        )}
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}

const REGISTRATION_UPI_ID = "sarkar.288@superyes";
const REGISTRATION_PLAYER_FEE = 550;
const REGISTRATION_VISITOR_FEE = 150;

// Standard NPCI "upi://pay" deep link — any UPI app installed on the
// device (GPay, PhonePe, Paytm, etc.) registers this scheme, so the OS
// shows its own app-picker rather than us needing per-app URIs.
function buildUpiLink(amount, note) {
  const params = new URLSearchParams({
    pa: REGISTRATION_UPI_ID,
    pn: "Bangalore Beyblade Association",
    am: String(amount),
    cu: "INR",
  });
  if (note) params.set("tn", note);
  return `upi://pay?${params.toString()}`;
}

function UpiPayButton({ amount, note }) {
  return (
    <a
      href={buildUpiLink(amount, note)}
      className="tap w-full py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
      style={{ background: "var(--accent2)", color: "#0A0D18" }}
    >
      <Icon name="wallet" size={15} /> Pay ₹{amount} with GPay / PhonePe / UPI
    </a>
  );
}

// Silently submits to a hidden Google Form on every registration, whose
// existing Zap (Google Forms trigger -> WhatsApp group message) is how
// the club gets notified — no backend needed, same no-cors form-post
// trick used by static sites without a server-side contact form.
const REGISTRATION_NOTIFY_FORM_ID = "1FAIpQLSfwTSmkYniXT6ckvazt49zc8gylQFbFrthZufqU7hpAjIK2qw";
const REGISTRATION_NOTIFY_ENTRIES = {
  participantName: "entry.536987989",
  bladerName: "entry.307278227",
  phone: "entry.591567370",
  age: "entry.1579085013",
  hasProducts: "entry.1246421358",
  hasVisitor: "entry.1509554680",
  visitorNames: "entry.185224915",
  agreed: "entry.828234838",
  amount: "entry.1629333670",
};

function notifyRegistrationForm(data) {
  const body = new URLSearchParams();
  for (const [key, entry] of Object.entries(REGISTRATION_NOTIFY_ENTRIES)) {
    body.set(entry, data[key] ?? "");
  }
  // no-cors: the response is opaque either way, so this is fire-and-forget —
  // a failed notification should never block or fail the real registration.
  fetch(`https://docs.google.com/forms/d/e/${REGISTRATION_NOTIFY_FORM_ID}/formResponse`, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }).catch((err) => console.error("notifyRegistrationForm failed", err));
}

const REGISTRATION_TERMS = [
  "All registrations are final and non-refundable.",
  "If any non-participants (spectators or accompanying guests) are joining along with participants, please make the payment for everyone in a single transaction to help us track payments efficiently.",
  "Beyblade is a skill-based game involving strategy, technique, and competitive play.",
  "Younger members are welcome to participate in the 13+ category, provided they are comfortable competing against adult players and comply with the event rules.",
  "By submitting this registration, you confirm that you have read, understood, and agree to abide by all BBA tournament rules, event guidelines, and the decisions of the organisers, which shall be final.",
  "Participants and accompanying guests are expected to keep the venue clean, dispose of waste responsibly, and help maintain a safe and welcoming environment for everyone.",
  "Participants are expected to treat the venue and its property with respect. Any damage to the venue, equipment, or property caused by a participant, whether intentional or due to negligence, will be the sole responsibility of that participant, and they agree to bear the full cost of repair or replacement.",
  "Once the registration is confirmed, no refunds / cancellations / transfers will be permitted under any circumstances.",
];

function CopyUpiButton({ copied, onCopy }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="tap px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
      style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}
    >
      <Icon name="copy" size={13} /> {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ---------- event registration — full in-app form matching BBA's
   participant registration spec, payment handled as a manual UPI
   handoff (same pattern as marketplace orders).                  */
function RegistrationPage({ event, user, onClose, fireToast }) {
  const [form, setForm] = useState({
    participantName: "",
    bladerName: "",
    phone: "",
    age: "",
    participantType: "",
    hasProducts: "",
    hasVisitor: "",
    visitorNames: [""],
    agreed: false,
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyUpi = () => {
    navigator.clipboard?.writeText(REGISTRATION_UPI_ID);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const visitorNames = form.visitorNames.map((n) => n.trim()).filter(Boolean);
  const visitorCount = form.hasVisitor === "yes" ? visitorNames.length : 0;
  const participantFee = form.participantType === "visitor" ? REGISTRATION_VISITOR_FEE : REGISTRATION_PLAYER_FEE;
  const totalDue = form.participantType ? participantFee + visitorCount * REGISTRATION_VISITOR_FEE : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.participantName || !form.bladerName || !form.phone || !form.age || !form.participantType || !form.hasProducts || !form.hasVisitor) {
      fireToast("Please fill in all required fields");
      return;
    }
    if (form.hasVisitor === "yes" && visitorNames.length === 0) {
      fireToast("Please add at least one visitor's name");
      return;
    }
    if (!form.agreed) {
      fireToast("Please agree to the terms & conditions");
      return;
    }
    setBusy(true);
    try {
      await createRegistration({
        eventId: event.id,
        eventName: event.name,
        userId: user.uid,
        userEmail: user.email,
        participantName: form.participantName,
        bladerName: form.bladerName,
        phone: form.phone,
        age: form.age,
        participantType: form.participantType,
        hasProducts: form.hasProducts === "yes",
        hasVisitor: form.hasVisitor === "yes",
        visitorNames: form.hasVisitor === "yes" ? visitorNames : [],
        paymentAmount: totalDue,
        agreed: true,
      });
      notifyRegistrationForm({
        participantName: form.participantName,
        bladerName: form.bladerName,
        phone: form.phone,
        age: form.age === "9-12" ? "9–12" : form.age === "13-17" ? "13–17" : "18 and above",
        hasProducts: form.hasProducts === "yes" ? "Yes" : "No",
        hasVisitor: form.hasVisitor === "yes" ? "Yes" : "No",
        visitorNames: visitorNames.join(", ") || "—",
        agreed: "Agree",
        amount: `${totalDue}(${form.participantType === "visitor" ? "Visitor" : "Player"}${visitorCount > 0 ? ` + ${visitorCount} visitor${visitorCount === 1 ? "" : "s"}` : ""})`,
      });
      setDone(true);
    } catch (err) {
      console.error("Registration submit failed", err);
      fireToast("Couldn't submit — please try again");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <DashboardPage icon="events" title="You're registered!" subtitle={event.name} onBack={onClose}>
        <div className="max-w-md p-6 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)", animation: `auth-in 380ms ${EASE}` }}>
          <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
            Pay your entry fee via UPI, then an admin will confirm your spot.
          </p>
          <div className="p-4 rounded-xl mb-5" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>UPI ID</div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{REGISTRATION_UPI_ID}</span>
              <CopyUpiButton copied={copied} onCopy={copyUpi} />
            </div>
            {totalDue > 0 && <UpiPayButton amount={totalDue} note={`${event.name} registration`} />}
          </div>
          <button onClick={onClose} className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
            Back to site
          </button>
        </div>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage icon="events" title="Register" subtitle={`${event.name} · ${formatEventDate(event.date)}`} onBack={onClose}>
      <form onSubmit={submit} className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <IconField icon="user" label="Name of Participant *" required value={form.participantName} onChange={(e) => setForm({ ...form, participantName: e.target.value })} />
          <IconField icon="blade" label="Blader Name *" required value={form.bladerName} onChange={(e) => setForm({ ...form, bladerName: e.target.value })} />
          <IconField icon="phone" label="Phone Number *" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Select your age *</span>
            <SegmentedToggle
              options={[
                { value: "9-12", label: "9–12" },
                { value: "13-17", label: "13–17" },
                { value: "18plus", label: "18+" },
              ]}
              value={form.age}
              onChange={(v) => setForm({ ...form, age: v })}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Are you coming as a Player or Visitor? *</span>
            <SegmentedToggle
              options={[
                { value: "player", label: `Player (₹${REGISTRATION_PLAYER_FEE})` },
                { value: "visitor", label: `Visitor (₹${REGISTRATION_VISITOR_FEE})` },
              ]}
              value={form.participantType}
              onChange={(v) => setForm({ ...form, participantType: v })}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Do you have Beyblade X products? *</span>
            <SegmentedToggle
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              value={form.hasProducts}
              onChange={(v) => setForm({ ...form, hasProducts: v })}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Anyone coming as a visitor / attendee? *</span>
            <SegmentedToggle
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              value={form.hasVisitor}
              onChange={(v) => setForm({ ...form, hasVisitor: v, visitorNames: v === "no" ? [""] : form.visitorNames })}
            />
          </div>

          {form.hasVisitor === "yes" && (
            <div style={{ animation: `auth-in 260ms ${EASE}` }}>
              <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Name(s) of Visitor / Attendee</span>
              <div className="space-y-2">
                {form.visitorNames.map((name, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="field-input flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg"
                      style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}
                    >
                      <span style={{ color: "var(--icon-dim)" }}><Icon name="user" size={15} /></span>
                      <input
                        value={name}
                        placeholder={`Visitor ${i + 1} name`}
                        onChange={(e) => {
                          const next = [...form.visitorNames];
                          next[i] = e.target.value;
                          setForm({ ...form, visitorNames: next });
                        }}
                        className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                        style={{ color: "var(--text)" }}
                      />
                    </div>
                    {form.visitorNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, visitorNames: form.visitorNames.filter((_, idx) => idx !== i) })}
                        className="tap shrink-0 flex items-center justify-center rounded-full"
                        style={{ width: 32, height: 32, border: "1px solid var(--border-strong)", color: "var(--danger)" }}
                        aria-label="Remove visitor"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, visitorNames: [...form.visitorNames, ""] })}
                className="tap mt-2 text-xs font-semibold"
                style={{ color: "var(--accent-ink)" }}
              >
                + Add another visitor
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: "var(--gold)" }}>
              <Icon name="info" size={15} />
              <span className="text-sm font-semibold">Payment info</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-dim)" }}>
              Entry fee for Players: <span style={{ color: "var(--text)" }}>₹{REGISTRATION_PLAYER_FEE} per person</span>
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
              Visitors / non-participants: <span style={{ color: "var(--text)" }}>₹{REGISTRATION_VISITOR_FEE} per person</span>
            </p>
            <div className="p-3 rounded-xl" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
              <div className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Total amount to pay</div>
              {form.participantType ? (
                <>
                  <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-dim)" }}>
                    <span>You ({form.participantType === "visitor" ? "Visitor" : "Player"})</span>
                    <span>₹{participantFee}</span>
                  </div>
                  {visitorCount > 0 && (
                    <div className="flex items-center justify-between text-xs mb-1" style={{ color: "var(--text-dim)" }}>
                      <span>{visitorCount} visitor{visitorCount === 1 ? "" : "s"} × ₹{REGISTRATION_VISITOR_FEE}</span>
                      <span>₹{visitorCount * REGISTRATION_VISITOR_FEE}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-lg font-bold" style={{ color: "var(--accent-ink)" }}>₹{totalDue}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>Select Player or Visitor above to see your total.</p>
              )}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-faint)" }}>
              Submit your registration below first — you'll get the UPI pay button and payment details right after, so there's always a record even if you get interrupted mid-payment.
            </p>
          </div>

          <div className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h4 className="text-sm font-semibold mb-2">Registration Terms &amp; Conditions</h4>
            <ul className="space-y-2 text-xs pr-1" style={{ color: "var(--text-dim)", maxHeight: 220, overflowY: "auto" }}>
              {REGISTRATION_TERMS.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: "var(--text-faint)" }}>•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Checkbox
              label="I have read and agree to the above Terms & Conditions and accept full responsibility for complying with BBA throughout the event. *"
              checked={form.agreed}
              onChange={(v) => setForm({ ...form, agreed: v })}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="tap w-full py-3 rounded-full text-sm font-semibold"
            style={{ background: "var(--accent2)", color: "#0A0D18", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Submitting…" : "Submit registration"}
          </button>
        </div>
      </form>
    </DashboardPage>
  );
}

/* ---------- small tab strip, reused across admin/seller sub-views ---------- */
function TabStrip({ tabs, active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mb-6">
      {tabs.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{
            background: active === k ? "var(--accent2)" : "var(--surface)",
            color: active === k ? "#0A0D18" : "var(--text-dim)",
            border: "1px solid var(--border)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function fieldStyle() {
  return { background: "var(--bg)", border: "1px solid var(--border-strong)", color: "var(--text)" };
}

/* ---------- generic centered confirm popup, reused for destructive actions ---------- */
function ConfirmModal({ title, message, confirmLabel = "Delete", busy, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <div onClick={onCancel} className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div className="relative w-full max-w-sm rounded-2xl p-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h3 className="disp font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-dim)" }}>{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="tap flex-1 py-2.5 rounded-full text-sm font-semibold"
            style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="tap flex-1 py-2.5 rounded-full text-sm font-semibold"
            style={{ background: "var(--danger)", color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- buyer ---------- */
function BuyerPanel({ products, onAdd, loaded }) {
  const [itemType, setItemType] = useState("All");
  const [condition, setCondition] = useState("All");

  const shown = products.filter(
    (p) =>
      (itemType === "All" || p.itemType === itemType) &&
      (condition === "All" || p.condition === condition)
  );

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Type</div>
          <TabStrip
            tabs={[["All", "All"], ...ITEM_TYPES.map((c) => [c, c])]}
            active={itemType}
            onChange={setItemType}
          />
        </div>
        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--text-faint)" }}>Condition</div>
          <TabStrip
            tabs={[["All", "All"], ...CONDITIONS.map((c) => [c, c])]}
            active={condition}
            onChange={setCondition}
          />
        </div>
      </div>
      {!loaded ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading listings…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No listings match these filters yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((p, i) => (
            <Reveal key={p.id} delay={i * 40}>
              <div className="lift p-5 rounded-2xl flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>{p.sellerName}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#00E6C31A", color: "var(--accent-ink)" }}>{p.itemType}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#7A81941A", color: "var(--text-dim)" }}>{p.condition}</span>
                  </div>
                </div>
                {p.itemType === "Beyblade" && p.beybladeCategory && (
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{p.beybladeCategory} type</span>
                )}
                <div className="flex items-center justify-between">
                  <span className="disp font-bold text-lg" style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{p.price}</span>
                  <span className="text-xs" style={{ color: "var(--text-faint)" }}>{p.stock} in stock</span>
                </div>
                <button
                  onClick={() => onAdd(p)}
                  className="tap mt-1 py-2 rounded-full text-sm font-semibold"
                  style={{ background: "var(--accent2)", color: "#0A0D18" }}
                >
                  Add to cart
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- seller ---------- */
function SellerPanel({ seller, profile, products, orders, onCreate, onSavePaymentInfo, onMarkPaid }) {
  const [tab, setTab] = useState("listings");
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
    itemType: "Beyblade",
    condition: "NIB",
    beybladeCategory: "Attack",
  });
  const [payForm, setPayForm] = useState({ upiId: "", paymentContact: "" });

  useEffect(() => {
    if (profile) {
      setPayForm({ upiId: profile.upiId || "", paymentContact: profile.paymentContact || "" });
    }
  }, [profile]);

  const submit = (e) => {
    e.preventDefault();
    if (!seller || !form.name || !form.price) return;
    onCreate({
      name: form.name,
      price: Number(form.price),
      stock: Number(form.stock) || 1,
      itemType: form.itemType,
      condition: form.condition,
      beybladeCategory: form.itemType === "Beyblade" ? form.beybladeCategory : null,
      sellerId: seller.uid,
      sellerName: seller.name,
    });
    setForm({ name: "", price: "", stock: "", itemType: "Beyblade", condition: "NIB", beybladeCategory: "Attack" });
  };

  return (
    <div>
      <TabStrip
        tabs={[
          ["listings", "Listings"],
          ["sales", "My Sales"],
          ["payment", "Payment Info"],
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "listings" && (
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold mb-4">List a new item</h3>
            <p className="text-xs mb-3" style={{ color: "var(--text-faint)" }}>
              Listing as <span style={{ color: "var(--accent-ink)" }}>{seller?.name}</span>.
            </p>
            <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <input
                placeholder="Item name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={fieldStyle()}
              />
              <div className="flex gap-3">
                <input
                  placeholder="Price ₹"
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle()}
                />
                <input
                  placeholder="Stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle()}
                />
              </div>
              <select
                value={form.itemType}
                onChange={(e) => setForm({ ...form, itemType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={fieldStyle()}
              >
                {ITEM_TYPES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={fieldStyle()}
              >
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
              {form.itemType === "Beyblade" && (
                <select
                  value={form.beybladeCategory}
                  onChange={(e) => setForm({ ...form, beybladeCategory: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle()}
                >
                  {BEYBLADE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              <button type="submit" className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
                Submit for approval
              </button>
            </form>
          </div>
          <div>
            <h3 className="font-semibold mb-4">My listings</h3>
            <div className="space-y-2">
              {products.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No listings yet.</p>}
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-faint)" }}>₹{p.price} · {p.itemType} · {p.condition}</div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "sales" && (
        <div className="space-y-2 max-w-xl">
          {orders.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No sales yet.</p>}
          {orders.map((o) => (
            <div key={o.id} className="p-4 rounded-xl flex items-center justify-between flex-wrap gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div>
                <div className="text-sm font-medium">{o.buyerName}</div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>{o.items.length} item(s) · ₹{o.total}</div>
                <OrderStatusBadge status={o.status} />
              </div>
              {o.status === "pending_payment" && (
                <button
                  onClick={() => onMarkPaid(o.id)}
                  className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "#0A0D18" }}
                >
                  Mark as paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "payment" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSavePaymentInfo(payForm);
          }}
          className="space-y-3 p-5 rounded-2xl max-w-sm"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>
            Shown to buyers at checkout so they can pay you directly.
          </p>
          <input
            placeholder="UPI ID"
            value={payForm.upiId}
            onChange={(e) => setPayForm({ ...payForm, upiId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle()}
          />
          <input
            placeholder="Other contact (phone/WhatsApp, optional)"
            value={payForm.paymentContact}
            onChange={(e) => setPayForm({ ...payForm, paymentContact: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={fieldStyle()}
          />
          <button type="submit" className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
            Save
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- admin ---------- */
function AdminPanel({
  products,
  onDecide,
  events,
  leaderboard,
  sheetStatus,
  sheetSynced,
  onRefreshSheet,
  season,
  onChangeSeason,
  rulebookText,
  fireToast,
  users,
  registrations,
  onSetRegistrationStatus,
  onDeleteRegistration,
  instagramPosts,
}) {
  const [tab, setTab] = useState("listings");

  return (
    <div>
      <TabStrip
        tabs={[
          ["listings", "Listings"],
          ["roles", "Roles"],
          ["events", "Events"],
          ["registrations", "Registrations"],
          ["leaderboard", "Leaderboard"],
          ["rulebook", "Rulebook"],
          ["instagram", "Instagram"],
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "listings" && <AdminListings products={products} onDecide={onDecide} />}
      {tab === "roles" && <AdminRoles fireToast={fireToast} users={users} />}
      {tab === "events" && <AdminEvents events={events} season={season} fireToast={fireToast} />}
      {tab === "registrations" && (
        <AdminRegistrations registrations={registrations} onSetStatus={onSetRegistrationStatus} onDelete={onDeleteRegistration} />
      )}
      {tab === "leaderboard" && (
        <AdminLeaderboard
          rows={leaderboard}
          sheetStatus={sheetStatus}
          sheetSynced={sheetSynced}
          onRefreshSheet={onRefreshSheet}
          season={season}
          onChangeSeason={onChangeSeason}
          fireToast={fireToast}
        />
      )}
      {tab === "rulebook" && <AdminRulebook text={rulebookText} fireToast={fireToast} />}
      {tab === "instagram" && <AdminInstagram posts={instagramPosts} fireToast={fireToast} />}
    </div>
  );
}

function AdminListings({ products, onDecide }) {
  const pending = products.filter((p) => p.status === "pending");
  const stats = {
    total: products.length,
    approved: products.filter((p) => p.status === "approved").length,
    pending: pending.length,
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-8 max-w-md">
        {[["Total", stats.total], ["Live", stats.approved], ["Pending", stats.pending]].map(([l, n]) => (
          <div key={l} className="p-4 rounded-xl text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="disp font-bold text-2xl" style={{ color: "var(--accent-ink)" }}>{n}</div>
            <div className="text-xs" style={{ color: "var(--text-faint)" }}>{l}</div>
          </div>
        ))}
      </div>
      <h3 className="font-semibold mb-3">Pending approvals</h3>
      {pending.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>Nothing waiting on review.</p>}
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs" style={{ color: "var(--text-faint)" }}>{p.sellerName} · ₹{p.price} · {p.itemType} · {p.condition}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onDecide(p.id, "approved")} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>Approve</button>
              <button onClick={() => onDecide(p.id, "rejected")} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatLastLogin(ts) {
  if (!ts) return "Never";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/* Events store their date as a plain YYYY-MM-DD string (native <input
   type="date">) — format it for display. Falls back to the raw string
   for any legacy event saved before the calendar picker existed, since
   those won't parse as a clean ISO date. */
function formatEventDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function AdminRoles({ fireToast, users }) {
  const { user: currentUser } = useAuth();
  const [filter, setFilter] = useState("");
  const [busyUid, setBusyUid] = useState(null);
  const [confirmUid, setConfirmUid] = useState(null);

  const assign = async (u, role) => {
    if (role === u.role) return;
    setBusyUid(u.uid);
    try {
      await setUserRole(u.uid, role);
      fireToast(`${u.name} is now ${role}`);
    } finally {
      setBusyUid(null);
    }
  };

  const toggleBlocked = async (u) => {
    if (u.uid === currentUser?.uid) {
      fireToast("You can't block your own account");
      return;
    }
    setBusyUid(u.uid);
    try {
      await setUserBlocked(u.uid, !u.blocked);
      fireToast(u.blocked ? `${u.name} unblocked` : `${u.name} blocked`);
    } finally {
      setBusyUid(null);
    }
  };

  const remove = async (u) => {
    if (u.uid === currentUser?.uid) {
      fireToast("You can't remove your own account");
      return;
    }
    setBusyUid(u.uid);
    try {
      await deleteUserProfile(u.uid);
      fireToast(`${u.name} removed from the directory`);
    } finally {
      setBusyUid(null);
      setConfirmUid(null);
    }
  };

  const q = filter.trim().toLowerCase();
  const shown = users
    .filter((u) => !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    .sort((a, b) => (b.lastLoginAt?.toMillis?.() ?? 0) - (a.lastLoginAt?.toMillis?.() ?? 0));

  return (
    <div>
      <input
        placeholder="Filter by name or email"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-lg text-sm outline-none mb-5"
        style={fieldStyle()}
      />
      {shown.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          {users.length === 0 ? "No one has signed in yet." : "No matches."}
        </p>
      ) : (
        <div className="rounded-2xl overflow-x-auto snap-x snap-proximity" style={{ background: "var(--surface)", border: "1px solid var(--border)", WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-faint)", textAlign: "left" }}>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Email</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Last login</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Role</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap snap-start">
                    {u.name}
                    {u.uid === currentUser?.uid && (
                      <span className="ml-2 text-xs" style={{ color: "var(--text-faint)" }}>(you)</span>
                    )}
                    {u.blocked && (
                      <span
                        className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#FF44251A", color: "var(--accent2-ink)" }}
                      >
                        Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap snap-start" style={{ color: "var(--text-dim)" }}>{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap snap-start" style={{ color: "var(--text-dim)" }}>
                    {formatLastLogin(u.lastLoginAt || u.updatedAt)}
                  </td>
                  <td className="px-4 py-3 snap-start">
                    <div className="flex gap-1.5 flex-wrap">
                      {["user", "seller", "admin"].map((r) => (
                        <button
                          key={r}
                          disabled={busyUid === u.uid || u.role === r}
                          onClick={() => assign(u, r)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{
                            background: u.role === r ? "var(--accent)" : "transparent",
                            color: u.role === r ? "#0A0D18" : "var(--text-dim)",
                            border: u.role === r ? "none" : "1px solid var(--border-strong)",
                          }}
                        >
                          <Icon name={r} size={13} /> {r}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 snap-start snap-always">
                    {u.uid === currentUser?.uid ? (
                      <span className="text-xs" style={{ color: "var(--text-faint)" }}>—</span>
                    ) : confirmUid === u.uid ? (
                      <div className="flex gap-1.5 flex-wrap items-center">
                        <span className="text-xs" style={{ color: "var(--bronze)" }}>Remove for good?</span>
                        <button
                          disabled={busyUid === u.uid}
                          onClick={() => remove(u)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{ background: "var(--accent2)", color: "#0A0D18" }}
                        >
                          <Icon name="remove" size={13} /> Confirm
                        </button>
                        <button
                          onClick={() => setConfirmUid(null)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          disabled={busyUid === u.uid}
                          onClick={() => toggleBlocked(u)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{
                            background: u.blocked ? "var(--accent)" : "transparent",
                            color: u.blocked ? "#0A0D18" : "var(--bronze)",
                            border: u.blocked ? "none" : "1px solid var(--border-strong)",
                          }}
                        >
                          <Icon name={u.blocked ? "unblock" : "block"} size={13} /> {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          disabled={busyUid === u.uid}
                          onClick={() => setConfirmUid(u.uid)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{ border: "1px solid var(--border-strong)", color: "var(--danger)" }}
                        >
                          <Icon name="remove" size={13} /> Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- icon field — labeled input with a leading icon that
   glows the whole pill on focus (via .field-input:focus-within) ---------- */
function IconField({ icon, label, ...props }) {
  return (
    <label className="block text-left">
      <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>{label}</span>
      <div
        className="field-input flex items-center gap-2 px-3 py-2.5 rounded-lg"
        style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}
      >
        <span style={{ color: "var(--icon-dim)" }}><Icon name={icon} size={15} /></span>
        <input
          {...props}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>
    </label>
  );
}

/* ---------- sliding segmented toggle ---------- */
function SegmentedToggle({ options, value, onChange }) {
  const idx = options.findIndex((o) => o.value === value);
  const pct = 100 / options.length;
  return (
    <div className="relative inline-flex p-1 rounded-full" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
      {idx >= 0 && (
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full"
          style={{
            left: `calc(${idx * pct}% + 4px)`,
            width: `calc(${pct}% - 8px)`,
            background: "var(--accent)",
            transition: `left 280ms ${EASE}`,
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className="tap relative px-4 py-1.5 rounded-full text-xs font-semibold"
          style={{ color: value === o.value ? "#0A0D18" : "var(--text-dim)", transition: `color 220ms ${EASE}`, zIndex: 1 }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ACCENT_SWATCHES = ["#FF4425", "#00E6C3", "#FFC240", "#9B7EF0", "#FF6FA5"];

/* ---------- custom checkbox — filled square, checkmark pops in ---------- */
function Checkbox({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="tap flex items-start gap-2 text-left">
      <span
        className="flex items-center justify-center rounded shrink-0"
        style={{
          width: 20,
          height: 20,
          marginTop: 1,
          background: checked ? "var(--accent)" : "transparent",
          border: checked ? "none" : "1px solid var(--border-strong)",
          transition: `background 180ms ${EASE}, border-color 180ms ${EASE}`,
        }}
      >
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--bg)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: `pop-in 200ms ${EASE}` }}
          >
            <path d="M4 12l5 5L20 6" />
          </svg>
        )}
      </span>
      <span className="text-sm" style={{ color: "var(--text)" }}>{label}</span>
    </button>
  );
}

function toggleArrayValue(arr, value, include) {
  return include ? [...arr, value] : arr.filter((v) => v !== value);
}

const AGE_CATEGORY_LABELS = { under13: "Under 13", "13plus": "13+" };
const PRIZE_PLACES = [["first", "1st"], ["second", "2nd"], ["third", "3rd"]];
const emptyPrizePlace = () => ({ amount: "", item: "" });
const emptyCategoryPrizes = () => ({ first: emptyPrizePlace(), second: emptyPrizePlace(), third: emptyPrizePlace() });
const emptyPrizes = () => ({ under13: emptyCategoryPrizes(), "13plus": emptyCategoryPrizes() });

/* ---------- live preview — mirrors the real timeline card so admins
   see exactly what they're publishing as they type ---------- */
function AgeBadge({ ageCategories }) {
  if (!ageCategories || ageCategories.length === 0) return null;
  return (
    <>
      {ageCategories.map((c) => (
        <span
          key={c}
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: "#FFC2401A", color: "var(--gold)" }}
        >
          {AGE_CATEGORY_LABELS[c]}
        </span>
      ))}
    </>
  );
}

// Renders "1st ₹2000 Trophy · 2nd ₹1000 Medal" per age category — skips
// categories/places with nothing filled in, so a half-empty prize table
// doesn't show up as a row of bare colons.
function PrizeSummary({ prizes, ageCategories, className = "text-sm mt-1" }) {
  if (!prizes || !ageCategories?.length) return null;
  const blocks = ageCategories
    .map((cat) => {
      const p = prizes[cat];
      if (!p) return null;
      const lines = PRIZE_PLACES.map(([key, label]) => {
        const place = p[key];
        if (!place || (!place.amount && !place.item)) return null;
        return `${label} ${[place.amount, place.item].filter(Boolean).join(" ")}`;
      }).filter(Boolean);
      return lines.length ? { cat, lines } : null;
    })
    .filter(Boolean);
  if (!blocks.length) return null;
  return (
    <div className={className}>
      {blocks.map(({ cat, lines }) => (
        <div key={cat} style={{ color: "var(--text-dim)" }}>
          <span className="font-semibold" style={{ color: "var(--gold)" }}>{AGE_CATEGORY_LABELS[cat]}:</span>{" "}
          {lines.join(" · ")}
        </div>
      ))}
    </div>
  );
}

// Every upcoming event stays visible (small in number, high-stakes — people
// need to see what's next and register), but past events collapse to the
// most recent couple by default once there's a real backlog of them, with
// a "show more" toggle — the same collapse pattern already used for the
// leaderboard's full standings, rather than introducing a new horizontal-
// scroll interaction just for this section.
const EVENTS_PAST_COLLAPSED_COUNT = 2;

function EventsTimeline({ events, onRegister }) {
  const [expanded, setExpanded] = useState(false);
  const upcoming = events.filter((t) => t.status === "upcoming");
  const past = events.filter((t) => t.status !== "upcoming");
  const shownPast = expanded ? past : past.slice(0, EVENTS_PAST_COLLAPSED_COUNT);
  const hiddenCount = past.length - shownPast.length;
  // `events` is already sorted latest-first, and upcoming (future-dated)
  // events always sort ahead of past ones in that order, so concatenating
  // the two filtered lists preserves the original chronological order.
  const shown = [...upcoming, ...shownPast];

  return (
    <>
      <div className="relative pl-8" style={{ borderLeft: "2px solid var(--border)" }}>
        {shown.map((t, i) => (
          <Reveal key={t.id} delay={i * 80} className="relative mb-10 last:mb-0">
            <div
              className="absolute rounded-full"
              style={{
                left: -40,
                top: 6,
                width: 14,
                height: 14,
                background: t.status === "upcoming" ? t.accent || "#FF4425" : "var(--text-faint)",
                boxShadow: `0 0 0 4px var(--bg)`,
              }}
            />
            <div
              className="lift p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4"
              style={{
                background: t.status === "upcoming" ? "var(--surface)" : "var(--bg)",
                border: `1px solid ${t.status === "upcoming" ? "var(--border)" : "var(--border-strong)"}`,
                opacity: t.status === "upcoming" ? 1 : 0.7,
              }}
            >
              <div
                className="rounded-xl shrink-0 flex items-center justify-center"
                style={{ width: 64, height: 64, background: "var(--border)" }}
              >
                <SpinningBey size={40} speed={i % 2 ? 2.2 : 3} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="disp font-semibold text-xl">{t.name}</h3>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: t.status === "upcoming" ? "#00E6C31A" : "#7A81941A",
                      color: t.status === "upcoming" ? "var(--accent-ink)" : "var(--text-dim)",
                    }}
                  >
                    {t.status === "upcoming" ? "Upcoming" : "Completed"}
                  </span>
                  <AgeBadge ageCategories={t.ageCategories} />
                </div>
                <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>{formatEventDate(t.date)} · {t.venue}</p>
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>{t.format}</p>
                <PrizeSummary prizes={t.prizes} ageCategories={t.ageCategories} />
              </div>
              <div className="flex gap-2 shrink-0">
                {t.status === "upcoming" && (
                  <button
                    onClick={() => onRegister(t)}
                    className="tap px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap"
                    style={{ background: "var(--accent2)", color: "#0A0D18" }}
                  >
                    Register
                  </button>
                )}
                <a
                  href={t.bracketUrl || "https://challonge.com/"}
                  target="_blank"
                  rel="noreferrer"
                  className="tap px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap"
                  style={{ border: "1px solid var(--border-strong)" }}
                >
                  Bracket ↗
                </a>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="tap w-full mt-2 py-3 rounded-full text-sm font-semibold"
          style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          Show {hiddenCount} more past event{hiddenCount === 1 ? "" : "s"}
        </button>
      )}
    </>
  );
}

function PrizeFieldsBlock({ label, value, onChange }) {
  return (
    <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
      <span className="text-xs font-semibold" style={{ color: "var(--gold)" }}>{label} prizes</span>
      {PRIZE_PLACES.map(([key, placeLabel]) => (
        <div key={key} className="flex gap-2 items-center">
          <span className="text-xs w-7 shrink-0" style={{ color: "var(--text-faint)" }}>{placeLabel}</span>
          <input
            placeholder="Amount, e.g. ₹2000"
            value={value[key].amount}
            onChange={(e) => onChange(key, "amount", e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={fieldStyle()}
          />
          <input
            placeholder="Item, e.g. Trophy"
            value={value[key].item}
            onChange={(e) => onChange(key, "item", e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs outline-none"
            style={fieldStyle()}
          />
        </div>
      ))}
    </div>
  );
}

function EventPreviewCard({ form }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="rounded-full"
          style={{ width: 6, height: 6, background: "var(--accent)", animation: "glow-pulse 1.8s ease-in-out infinite" }}
        />
        <span className="text-xs font-semibold" style={{ color: "var(--text-faint)", letterSpacing: 0.5 }}>LIVE PREVIEW</span>
      </div>
      <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
        <span className="rounded-full shrink-0" style={{ width: 12, height: 12, background: form.accent || "#FF4425" }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="disp font-semibold text-base truncate">{form.name || "Event name"}</span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: form.status === "upcoming" ? "#00E6C31A" : "#7A81941A",
                color: form.status === "upcoming" ? "var(--accent-ink)" : "var(--text-dim)",
              }}
            >
              {form.status === "upcoming" ? "Upcoming" : "Completed"}
            </span>
            <AgeBadge ageCategories={form.ageCategories} />
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{formatEventDate(form.date) || "Date"} · {form.venue || "Venue"}</div>
          <div className="text-xs" style={{ color: "var(--text-faint)" }}>{form.format || "Format"}</div>
          <PrizeSummary prizes={form.prizes} ageCategories={form.ageCategories} className="text-xs mt-1" />
        </div>
      </div>
    </div>
  );
}

function RegistrationStatusBadge({ status }) {
  const map = {
    pending: ["var(--gold)", "Pending"],
    confirmed: ["var(--accent)", "Payment Confirmed"],
  };
  const [color, label] = map[status] || map.pending;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: color + "1A", color }}>
      {label}
    </span>
  );
}

const REGISTRATION_AGE_OPTIONS = [
  { value: "9-12", label: "9–12" },
  { value: "13-17", label: "13–17" },
  { value: "18plus", label: "18+" },
];

function AdminRegistrations({ registrations, onSetStatus, onDelete }) {
  const [filter, setFilter] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productsFilter, setProductsFilter] = useState("");
  const [visitorFilter, setVisitorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const ageLabel = (age) => (age === "9-12" ? "9–12" : age === "13-17" ? "13–17" : age === "18plus" ? "18+" : age || "—");

  const q = filter.trim().toLowerCase();
  const shown = registrations
    .filter(
      (r) =>
        !q ||
        r.participantName?.toLowerCase().includes(q) ||
        r.bladerName?.toLowerCase().includes(q) ||
        r.eventName?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q)
    )
    .filter((r) => !ageFilter || r.age === ageFilter)
    .filter((r) => !typeFilter || (r.participantType === "visitor" ? "visitor" : "player") === typeFilter)
    .filter((r) => !productsFilter || (r.hasProducts ? "yes" : "no") === productsFilter)
    .filter((r) => !visitorFilter || (r.hasVisitor ? "yes" : "no") === visitorFilter)
    .filter((r) => !statusFilter || (r.status || "pending") === statusFilter)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const confirm = async (r) => {
    setBusyId(r.id);
    try {
      await onSetStatus(r.id, "confirmed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        <input
          placeholder="Filter by name, phone, or event"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-sm px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle()}
        />
        <select value={ageFilter} onChange={(e) => setAgeFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="">All ages</option>
          {REGISTRATION_AGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="">All types</option>
          <option value="player">Player</option>
          <option value="visitor">Visitor</option>
        </select>
        <select value={productsFilter} onChange={(e) => setProductsFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="">Products: all</option>
          <option value="yes">Has products</option>
          <option value="no">No products</option>
        </select>
        <select value={visitorFilter} onChange={(e) => setVisitorFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="">Visitor: all</option>
          <option value="yes">Has visitor</option>
          <option value="no">No visitor</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Payment Confirmed</option>
        </select>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          {registrations.length === 0 ? "No registrations yet." : "No matches."}
        </p>
      ) : (
        <div className="rounded-2xl overflow-x-auto snap-x snap-proximity" style={{ background: "var(--surface)", border: "1px solid var(--border)", WebkitOverflowScrolling: "touch" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-faint)", textAlign: "left" }}>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Registered</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Event</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Participant</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Blader name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Age</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Products?</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Visitor</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Paid (₹)</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap snap-start">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 whitespace-nowrap snap-start" style={{ color: "var(--text-dim)" }}>{formatLastLogin(r.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.eventName}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.participantName}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.bladerName}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{ageLabel(r.age)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.participantType === "visitor" ? "Visitor" : "Player"}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.hasProducts ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>
                    {r.hasVisitor ? r.visitorNames?.join(", ") || "Yes" : "No"}
                  </td>
                  <td
                    className="px-4 py-3 whitespace-nowrap"
                    style={{ color: "var(--text-dim)", fontFamily: "'JetBrains Mono',monospace" }}
                  >
                    {r.paymentAmount || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><RegistrationStatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap snap-start snap-always">
                    <div className="flex gap-1.5">
                      {r.status !== "confirmed" && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => confirm(r)}
                          className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{ background: "var(--accent)", color: "#0A0D18" }}
                        >
                          Payment Confirmed
                        </button>
                      )}
                      <button
                        disabled={busyId === r.id}
                        onClick={() => setDeleteTarget(r)}
                        className="tap shrink-0 flex items-center justify-center rounded-full"
                        style={{ width: 30, height: 30, border: "1px solid var(--border-strong)", color: "var(--danger)" }}
                        aria-label="Delete registration"
                      >
                        <Icon name="remove" size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete this registration?"
          message={`This permanently removes ${deleteTarget.participantName}'s registration for ${deleteTarget.eventName}. This can't be undone.`}
          busy={busyId === deleteTarget.id}
          onConfirm={remove}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function AdminEvents({ events, season, fireToast }) {
  const empty = {
    name: "",
    date: "",
    venue: "",
    format: "",
    status: "upcoming",
    bracketUrl: "",
    accent: "var(--accent2)",
    ageCategories: [],
    prizes: emptyPrizes(),
    season,
  };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const updatePrize = (cat, place, field, val) => {
    setForm((f) => ({
      ...f,
      prizes: {
        ...f.prizes,
        [cat]: { ...f.prizes[cat], [place]: { ...f.prizes[cat][place], [field]: val } },
      },
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    if (editingId) {
      await updateEvent(editingId, form);
      fireToast("Event updated");
    } else {
      await createEvent(form);
      fireToast("Event created");
    }
    setForm(empty);
    setEditingId(null);
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <div className="mb-5">
          <EventPreviewCard form={form} />
        </div>
        <form onSubmit={submit} className="space-y-4 p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h3 className="font-semibold">{editingId ? "Edit event" : "New event"}</h3>

          <IconField icon="events" label="Name" placeholder="e.g. Whitefield Winter Clash" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <IconField icon="events" label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <IconField icon="pin" label="Venue" placeholder="e.g. Whitefield Community Hall" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <IconField icon="format" label="Format" placeholder="e.g. Double Elimination · 27 Bladers" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} />
          <IconField icon="link" label="Bracket URL" placeholder="https://challonge.com/…" value={form.bracketUrl} onChange={(e) => setForm({ ...form, bracketUrl: e.target.value })} />

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Season</span>
            <input
              type="number"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: parseInt(e.target.value, 10) || 1 })}
              className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
              style={fieldStyle()}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
              Which season's leaderboard this event's scores count toward.
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Status</span>
            <SegmentedToggle
              options={[{ value: "upcoming", label: "Upcoming" }, { value: "completed", label: "Completed" }]}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Age category</span>
            <div className="flex gap-5">
              <Checkbox
                label="Under 13"
                checked={form.ageCategories.includes("under13")}
                onChange={(v) => setForm({ ...form, ageCategories: toggleArrayValue(form.ageCategories, "under13", v) })}
              />
              <Checkbox
                label="13+"
                checked={form.ageCategories.includes("13plus")}
                onChange={(v) => setForm({ ...form, ageCategories: toggleArrayValue(form.ageCategories, "13plus", v) })}
              />
            </div>
          </div>

          {form.ageCategories.length > 0 && (
            <div>
              <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Prizes</span>
              <div className="space-y-2">
                {form.ageCategories.includes("under13") && (
                  <PrizeFieldsBlock
                    label="Under 13"
                    value={form.prizes.under13}
                    onChange={(place, field, val) => updatePrize("under13", place, field, val)}
                  />
                )}
                {form.ageCategories.includes("13plus") && (
                  <PrizeFieldsBlock
                    label="13+"
                    value={form.prizes["13plus"]}
                    onChange={(place, field, val) => updatePrize("13plus", place, field, val)}
                  />
                )}
              </div>
            </div>
          )}

          <div>
            <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-faint)" }}>Accent</span>
            <div className="flex gap-2.5">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, accent: c })}
                  className="swatch tap rounded-full"
                  style={{
                    width: 26,
                    height: 26,
                    background: c,
                    boxShadow: form.accent === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : "none",
                  }}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="tap flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
              {editingId ? "Save changes" : "Create event"}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="tap px-4 rounded-full text-sm font-semibold" style={{ border: "1px solid var(--border-strong)" }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="space-y-2">
        {events.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No events yet.</p>}
        {events.map((ev) => (
          <div key={ev.id} className="lift p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: ev.accent || "var(--accent2)" }} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{ev.name}</div>
                  <AgeBadge ageCategories={ev.ageCategories} />
                </div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>{formatEventDate(ev.date)} · {ev.status}</div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setForm({ ...empty, ...ev, season: ev.season ?? 1 }); setEditingId(ev.id); }} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>Edit</button>
              <button onClick={() => deleteEvent(ev.id)} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--danger)" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The leaderboard is read straight from the club's Google Sheet (see
// useLiveLeaderboard) — nothing here writes scores. This tab is just
// visibility into that sync plus the season-number control, which is
// independent of where the standings data comes from.
function AdminLeaderboard({ rows, sheetStatus, sheetSynced, onRefreshSheet, season, onChangeSeason, fireToast }) {
  const [newSeasonInput, setNewSeasonInput] = useState(String(season + 1));

  const startNewSeason = async () => {
    const n = parseInt(newSeasonInput, 10);
    if (!n || n === season) return;
    await onChangeSeason(n);
    setNewSeasonInput(String(n + 1));
  };

  const statusLabel = {
    loading: "Loading…",
    refreshing: "Refreshing…",
    ok: sheetSynced ? `Synced ${sheetSynced.toLocaleTimeString()}` : "Synced",
    error: "Couldn't reach the sheet",
  }[sheetStatus] || sheetStatus;

  return (
    <div>
      <div className="mb-6 p-4 rounded-2xl flex flex-wrap items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-sm">
          Current season: <span className="font-semibold" style={{ color: "var(--accent-ink)" }}>Season {season}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            value={newSeasonInput}
            onChange={(e) => setNewSeasonInput(e.target.value)}
            className="w-20 px-3 py-1.5 rounded-lg text-sm outline-none"
            style={fieldStyle()}
          />
          <button onClick={startNewSeason} className="tap px-4 py-1.5 rounded-full text-xs font-semibold" style={{ background: "var(--accent2)", color: "#0A0D18" }}>
            Start new season
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-2xl flex flex-wrap items-center gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div>
          <div className="text-sm font-semibold">Live from Google Sheets</div>
          <div className="text-xs" style={{ color: sheetStatus === "error" ? "var(--danger)" : "var(--text-faint)" }}>
            {statusLabel} · edit scores in the sheet itself, this app just displays it
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <a
            href={LEADERBOARD_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="tap px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}
          >
            Open sheet ↗
          </a>
          <button
            onClick={() => {
              onRefreshSheet();
              fireToast("Refreshing from the sheet…");
            }}
            className="tap px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "var(--accent)", color: "#0A0D18" }}
          >
            Refresh now
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            {sheetStatus === "error" ? "Couldn't load standings from the sheet." : "No standings in the sheet yet."}
          </p>
        )}
        {rows.map((row, i) => (
          <div key={row.id} className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <span className="text-xs w-6 text-right" style={{ color: "var(--text-faint)", fontFamily: "'JetBrains Mono',monospace" }}>{i + 1}</span>
              <span className="text-sm font-medium">{row.name}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--gold)", fontFamily: "'JetBrains Mono',monospace" }}>{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminRulebook({ text, fireToast }) {
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);

  const save = async () => {
    await setRulebook(draft, "admin");
    fireToast("Rulebook published");
  };

  return (
    <div className="max-w-2xl">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={16}
        placeholder="Write the rulebook here — plain text, line breaks are preserved."
        className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
        style={{ ...fieldStyle(), resize: "vertical", fontFamily: "'JetBrains Mono',monospace" }}
      />
      <button onClick={save} className="tap px-5 py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
        Publish
      </button>
    </div>
  );
}

function AdminInstagram({ posts, fireToast }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = instagramEmbedSrc(url);

  const add = async (e) => {
    e.preventDefault();
    if (!preview) {
      fireToast("That doesn't look like an Instagram post URL");
      return;
    }
    setBusy(true);
    try {
      await addInstagramPost(url.trim());
      setUrl("");
      fireToast("Added to the Instagram gallery");
    } catch (err) {
      console.error("addInstagramPost failed", err);
      fireToast("Couldn't add that post — please try again");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (post) => {
    try {
      await deleteInstagramPost(post.id);
      fireToast("Removed from the gallery");
    } catch (err) {
      console.error("deleteInstagramPost failed", err);
      fireToast("Couldn't remove that post — please try again");
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
        Paste a link to any public post on{" "}
        <a
          href="https://www.instagram.com/bangalore_beyblade_association/"
          target="_blank"
          rel="noreferrer"
          className="tap font-semibold"
          style={{ color: "var(--accent-ink)" }}
        >
          @bangalore_beyblade_association
        </a>{" "}
        (open the post → ⋯ → Copy Link). No login or API key needed — it embeds directly.
      </p>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <input
          placeholder="https://www.instagram.com/p/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
          style={fieldStyle()}
        />
        <button disabled={busy} type="submit" className="tap px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
          Add
        </button>
      </form>
      {url && !preview && (
        <p className="text-xs mb-4" style={{ color: "var(--danger)" }}>Doesn't look like a valid Instagram post link yet.</p>
      )}
      {preview && (
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-2">
            <span
              className="rounded-full"
              style={{ width: 6, height: 6, background: "var(--accent)", animation: "glow-pulse 1.8s ease-in-out infinite" }}
            />
            <span className="text-xs font-semibold" style={{ color: "var(--text-faint)", letterSpacing: 0.5 }}>PREVIEW</span>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ height: 460, maxWidth: 400, border: "1px solid var(--border)" }}>
            <iframe
              src={preview}
              title="Preview"
              loading="lazy"
              scrolling="no"
              style={{ width: "100%", height: 700, border: "none", marginTop: -1 }}
            />
          </div>
        </div>
      )}
      <h3 className="font-semibold mb-3">Featured posts ({posts.length})</h3>
      {posts.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No posts added yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3 rounded-xl gap-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span className="text-sm truncate" style={{ color: "var(--text-dim)" }}>{p.url}</span>
              <button
                onClick={() => remove(p)}
                className="tap px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
                style={{ border: "1px solid var(--border-strong)", color: "var(--danger)" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved: ["var(--accent)", "Live"],
    pending: ["var(--gold)", "Pending"],
    rejected: ["var(--accent2)", "Rejected"],
  };
  const [color, label] = map[status] || map.pending;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: color + "1A", color }}>
      {label}
    </span>
  );
}

function OrderStatusBadge({ status }) {
  const map = {
    pending_payment: ["var(--gold)", "Awaiting payment"],
    paid: ["var(--accent)", "Paid"],
    cancelled: ["var(--accent2)", "Cancelled"],
  };
  const [color, label] = map[status] || map.pending_payment;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full inline-block mt-1" style={{ background: color + "1A", color }}>
      {label}
    </span>
  );
}
