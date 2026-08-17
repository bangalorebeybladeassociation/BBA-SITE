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
  listenLeaderboard,
  createLeaderboardEntry,
  updateLeaderboardEntry,
  deleteLeaderboardEntry,
  replaceLeaderboard,
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
function RankRing({ rank, tied }) {
  const color = rank === 1 ? "var(--gold)" : rank === 2 ? "var(--silver)" : rank === 3 ? "var(--bronze)" : "var(--text-faint)";
  const label = tied ? `T-${rank}` : rank;
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: 44, height: 44 }}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" className="absolute inset-0">
        <circle cx="22" cy="22" r="19" fill="none" stroke="var(--border-strong)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r="19"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${Math.max(10, 120 / rank)} 200`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span
        className="relative font-semibold"
        style={{ fontFamily: "'JetBrains Mono', monospace", color, fontSize: tied ? 11 : 14 }}
      >
        {label}
      </span>
    </div>
  );
}

const LEADERBOARD_COLLAPSED_COUNT = 10;

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

function LeaderboardList({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const ranked = rankLeaderboard(rows);
  const shown = expanded ? ranked : ranked.slice(0, LEADERBOARD_COLLAPSED_COUNT);
  const hasMore = ranked.length > LEADERBOARD_COLLAPSED_COUNT;

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        {shown.map((row, i) => (
          <Reveal key={row.id} delay={i * 50}>
            <div
              className="flex items-center gap-4 px-5 py-4"
              style={{ borderTop: i ? "1px solid var(--border)" : "none" }}
            >
              <RankRing rank={row.rank} tied={row.tied} />
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2 flex-wrap">
                  {row.name}
                  {row.tied && (
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: "#FF93541A", color: "var(--bronze)" }}
                    >
                      TIE
                    </span>
                  )}
                </div>
                {row.region && <div className="text-xs" style={{ color: "var(--text-faint)" }}>{row.region}</div>}
              </div>
              <div className="disp font-bold text-lg" style={{ color: "var(--accent-ink)", width: 70, textAlign: "right" }}>{row.points}</div>
            </div>
          </Reveal>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="tap w-full mt-4 py-3 rounded-full text-sm font-semibold"
          style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}
        >
          {expanded ? "Show less" : `Show all ${rows.length} bladers`}
        </button>
      )}
    </>
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

function useLeaderboardRows() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenLeaderboard(setRows);
  }, []);
  return [...rows].sort((a, b) => (b.points || 0) - (a.points || 0));
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
  const leaderboard = useLeaderboardRows();
  const season = useSeason();
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
        }
        @keyframes blade-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes toast-in { from { opacity:0; transform: translate(-50%,12px);} to {opacity:1; transform: translate(-50%,0);} }
        @keyframes pop-in { from { opacity:0; transform: scale(0.7);} to {opacity:1; transform: scale(1);} }
        @keyframes auth-in { from { opacity:0; transform: translateY(14px);} to {opacity:1; transform: translateY(0);} }
        @keyframes glow-pulse { 0%,100% { opacity:0.5;} 50% { opacity:0.9;} }
        .disp { font-family:'Rajdhani',sans-serif; }
        .tap { transition: transform 200ms ${EASE}, opacity 150ms ${EASE}, filter 200ms ${EASE}; }
        .tap:active { transform: scale(0.96); opacity:0.85; }
        .lift { transition: transform 260ms ${EASE}, box-shadow 260ms ${EASE}, border-color 260ms ${EASE}; }
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
              fireToast(status === "confirmed" ? "Registration confirmed" : "Registration updated");
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
            ["#events", "Events", "Every event, past and upcoming, with live brackets"],
            ["#media", "Media", "Photos and highlights from our Instagram"],
            ["#leaderboard", "Leaderboard", `Season ${season} rankings across all events`],
            ["#market", "Shop", "Buy parts, or sell your own as an approved seller"],
          ].map(([href, title, desc]) => (
            <a
              key={href}
              href={href}
              className="tap lift p-4 rounded-2xl block"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="disp font-semibold text-base" style={{ color: "var(--accent-ink)" }}>{title}</div>
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
        <div className="relative pl-8" style={{ borderLeft: "2px solid var(--border)" }}>
          {events.map((t, i) => (
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
                      onClick={() => openRegistration(t)}
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
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Season {season} Leaderboard</h2>
          <p style={{ color: "var(--text-dim)" }} className="mb-10">Points from all sanctioned Bangalore events, merged by ranking.</p>
        </Reveal>
        {(() => {
          const seasonRows = leaderboard.filter((row) => (row.season ?? 1) === season);
          return seasonRows.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-faint)" }}>No standings posted yet.</p>
          ) : (
            <LeaderboardList rows={seasonRows} />
          );
        })()}
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
    hasProducts: "",
    hasVisitor: "",
    visitorNames: [""],
    paymentAmount: "",
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

  const submit = async (e) => {
    e.preventDefault();
    if (!form.participantName || !form.bladerName || !form.phone || !form.age || !form.hasProducts || !form.hasVisitor) {
      fireToast("Please fill in all required fields");
      return;
    }
    const visitorNames = form.visitorNames.map((n) => n.trim()).filter(Boolean);
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
        hasProducts: form.hasProducts === "yes",
        hasVisitor: form.hasVisitor === "yes",
        visitorNames: form.hasVisitor === "yes" ? visitorNames : [],
        paymentAmount: form.paymentAmount,
        agreed: true,
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{REGISTRATION_UPI_ID}</span>
              <CopyUpiButton copied={copied} onCopy={copyUpi} />
            </div>
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
              Entry fee for Participants: <span style={{ color: "var(--text)" }}>₹550 per person</span>
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
              Non-participants: <span style={{ color: "var(--text)" }}>₹150 per person</span>
            </p>
            <div className="p-3 rounded-xl mb-3" style={{ background: "var(--bg)", border: "1px solid var(--border-strong)" }}>
              <div className="text-xs mb-1" style={{ color: "var(--text-faint)" }}>Pay via UPI</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--accent-ink)" }}>{REGISTRATION_UPI_ID}</span>
                <CopyUpiButton copied={copied} onCopy={copyUpi} />
              </div>
            </div>
            <IconField
              icon="format"
              label="Payment amount made (₹)"
              type="number"
              value={form.paymentAmount}
              onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })}
            />
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
  season,
  onChangeSeason,
  rulebookText,
  fireToast,
  users,
  registrations,
  onSetRegistrationStatus,
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
      {tab === "events" && <AdminEvents events={events} fireToast={fireToast} />}
      {tab === "registrations" && (
        <AdminRegistrations registrations={registrations} onSetStatus={onSetRegistrationStatus} />
      )}
      {tab === "leaderboard" && (
        <AdminLeaderboard rows={leaderboard} season={season} onChangeSeason={onChangeSeason} fireToast={fireToast} />
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
        <div className="rounded-2xl overflow-x-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-faint)", textAlign: "left" }}>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Last login</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Role</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
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
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>
                    {formatLastLogin(u.lastLoginAt || u.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
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
    confirmed: ["var(--accent)", "Confirmed"],
  };
  const [color, label] = map[status] || map.pending;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: color + "1A", color }}>
      {label}
    </span>
  );
}

function AdminRegistrations({ registrations, onSetStatus }) {
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState(null);

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
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const confirm = async (r) => {
    setBusyId(r.id);
    try {
      await onSetStatus(r.id, "confirmed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <input
        placeholder="Filter by name, phone, or event"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-lg text-sm outline-none mb-5"
        style={fieldStyle()}
      />
      {shown.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          {registrations.length === 0 ? "No registrations yet." : "No matches."}
        </p>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-faint)", textAlign: "left" }}>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Event</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Participant</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Blader name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Age</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Products?</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Visitor</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Paid (₹)</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 whitespace-nowrap">{r.eventName}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.participantName}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.bladerName}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{r.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--text-dim)" }}>{ageLabel(r.age)}</td>
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.status !== "confirmed" && (
                      <button
                        disabled={busyId === r.id}
                        onClick={() => confirm(r)}
                        className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{ background: "var(--accent)", color: "#0A0D18" }}
                      >
                        Mark confirmed
                      </button>
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

function AdminEvents({ events, fireToast }) {
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
              <button onClick={() => { setForm({ ...empty, ...ev }); setEditingId(ev.id); }} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>Edit</button>
              <button onClick={() => deleteEvent(ev.id)} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--danger)" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLeaderboard({ rows, season, onChangeSeason, fireToast }) {
  const [subtab, setSubtab] = useState("manage");
  const [viewingSeason, setViewingSeason] = useState(season);
  const [newSeasonInput, setNewSeasonInput] = useState(String(season + 1));
  const empty = { name: "", region: "", points: "", wins: "", losses: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  // Seasons with data plus whatever's currently live, so a fresh season with
  // no standings yet still shows up as a tab.
  const seasonNumbers = Array.from(
    new Set([...rows.map((r) => r.season ?? 1), season])
  ).sort((a, b) => b - a);
  const viewingRows = rows.filter((r) => (r.season ?? 1) === viewingSeason);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = {
      name: form.name,
      region: form.region,
      points: Number(form.points) || 0,
      wins: Number(form.wins) || 0,
      losses: Number(form.losses) || 0,
      season: viewingSeason,
    };
    if (editingId) {
      await updateLeaderboardEntry(editingId, payload);
      fireToast("Standing updated");
    } else {
      await createLeaderboardEntry(payload);
      fireToast("Standing added");
    }
    setForm(empty);
    setEditingId(null);
  };

  const startNewSeason = async () => {
    const n = parseInt(newSeasonInput, 10);
    if (!n || n === season) return;
    await onChangeSeason(n);
    setViewingSeason(n);
    setNewSeasonInput(String(n + 1));
  };

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
      <p className="text-xs mb-2" style={{ color: "var(--text-faint)" }}>Viewing standings for</p>
      <TabStrip
        tabs={seasonNumbers.map((n) => [n, `Season ${n}`])}
        active={viewingSeason}
        onChange={setViewingSeason}
      />
      <TabStrip
        tabs={[["manage", "Manage"], ["import", "Bulk Import"]]}
        active={subtab}
        onChange={setSubtab}
      />
      {subtab === "manage" && (
        <div className="grid md:grid-cols-2 gap-8">
          <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 className="font-semibold mb-1">{editingId ? "Edit standing" : `Add standing — Season ${viewingSeason}`}</h3>
            <input placeholder="Blader name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
            <input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
            <div className="flex gap-3">
              <input placeholder="Points" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
              <input placeholder="Wins" type="number" value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
              <input placeholder="Losses" type="number" value={form.losses} onChange={(e) => setForm({ ...form, losses: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="tap flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: "var(--accent)", color: "#0A0D18" }}>
                {editingId ? "Save changes" : "Add"}
              </button>
              {editingId && (
                <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="tap px-4 rounded-full text-sm font-semibold" style={{ border: "1px solid var(--border-strong)" }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="space-y-2">
            {viewingRows.length === 0 && <p className="text-sm" style={{ color: "var(--text-faint)" }}>No standings yet.</p>}
            {viewingRows.map((row) => (
              <div key={row.id} className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div>
                  <div className="text-sm font-medium">{row.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>{row.points} pts · {row.wins ?? 0}-{row.losses ?? 0}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setForm({ ...empty, ...row }); setEditingId(row.id); }} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>Edit</button>
                  <button onClick={() => deleteLeaderboardEntry(row.id)} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--danger)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {subtab === "import" && (
        <LeaderboardBulkImport currentCount={viewingRows.length} season={viewingSeason} fireToast={fireToast} />
      )}
    </div>
  );
}

// Splits a pasted spreadsheet block (header row + one row per blader,
// tab-separated — exactly what you get pasting from Sheets/Excel) and
// pulls out just the Name and TOTAL columns by header text, since that's
// all this app's leaderboard model tracks. Ignores per-event columns.
function parseLeaderboardPaste(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const totalIdx = headers.findIndex((h) => h.includes("total"));
  if (nameIdx === -1 || totalIdx === -1) return [];
  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split("\t");
      const name = (cols[nameIdx] || "").trim();
      const points = parseInt((cols[totalIdx] || "0").trim(), 10) || 0;
      return { name, points };
    })
    .filter((r) => r.name);
}

function LeaderboardBulkImport({ currentCount, season, fireToast }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const parsed = parseLeaderboardPaste(text);

  const run = async () => {
    setBusy(true);
    try {
      await replaceLeaderboard(parsed.map((r) => ({ name: r.name, points: r.points, region: "", wins: 0, losses: 0 })), season);
      fireToast(`Season ${season} leaderboard replaced with ${parsed.length} bladers`);
      setText("");
      setConfirming(false);
    } catch (err) {
      console.error("replaceLeaderboard failed", err);
      fireToast("Couldn't update the leaderboard — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
        Paste a whole season sheet — header row plus one row per blader, copied straight from
        Sheets/Excel. Only the <strong style={{ color: "var(--text)" }}>name</strong> and{" "}
        <strong style={{ color: "var(--text)" }}>TOTAL</strong> columns are used, since this app tracks
        overall points rather than per-event breakdowns. This{" "}
        <strong style={{ color: "var(--text)" }}>replaces all of Season {season}'s standings</strong> — other
        seasons are untouched.
      </p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setConfirming(false);
        }}
        rows={10}
        placeholder="Paste the full sheet here, including the header row"
        className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
        style={{ ...fieldStyle(), resize: "vertical", fontFamily: "'JetBrains Mono',monospace" }}
      />
      {text && parsed.length === 0 && (
        <p className="text-xs mb-4" style={{ color: "var(--danger)" }}>
          Couldn't find "Name" and "TOTAL" columns — make sure you pasted the header row too.
        </p>
      )}
      {parsed.length > 0 && (
        <>
          <p className="text-sm mb-3" style={{ color: "var(--accent-ink)" }}>
            Parsed {parsed.length} bladers — this will replace all {currentCount} current standings.
          </p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="tap px-5 py-2.5 rounded-full text-sm font-semibold"
              style={{ background: "var(--accent2)", color: "#0A0D18" }}
            >
              Replace leaderboard
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: "var(--bronze)" }}>Sure? This can't be undone.</span>
              <button
                disabled={busy}
                onClick={run}
                className="tap px-4 py-2 rounded-full text-xs font-semibold"
                style={{ background: "var(--accent2)", color: "#0A0D18" }}
              >
                {busy ? "Replacing…" : "Confirm replace"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="tap px-4 py-2 rounded-full text-xs font-semibold"
                style={{ border: "1px solid var(--border-strong)", color: "var(--text-dim)" }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
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
