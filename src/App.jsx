import React, { useState, useEffect, useRef, useCallback } from "react";
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
  listenRulebook,
  setRulebook,
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
} from "./lib/firestore";

/* ---------------------------------------------------------
   BANGALORE BEYBLADE ASSOCIATION — tournament hub + shop
   Design tokens
   bg        #0A0D18   surface   #141827   surface-2 #1C2136
   orange    #FF4425   cyan      #00E6C3   gold      #FFC240
   text      #F4F2EC   steel     #7A8194
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
        background: "#141827",
        border: "1px solid #1C2136",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 700ms ${EASE} ${delay}ms, transform 700ms ${EASE} ${delay}ms`,
      }}
    >
      <div className="disp font-bold" style={{ fontSize: 34, color: "#00E6C3" }}>
        {numeric !== null ? count : value}{suffix}
      </div>
      <div className="text-sm mt-1" style={{ color: "#9AA1B4" }}>{label}</div>
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
function RankRing({ rank }) {
  const color = rank === 1 ? "#FFC240" : rank === 2 ? "#C7CCDA" : rank === 3 ? "#FF9354" : "#7A8194";
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: 44, height: 44 }}
    >
      <svg viewBox="0 0 44 44" width="44" height="44" className="absolute inset-0">
        <circle cx="22" cy="22" r="19" fill="none" stroke="#2A3050" strokeWidth="3" />
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
        style={{ fontFamily: "'JetBrains Mono', monospace", color, fontSize: 14 }}
      >
        {rank}
      </span>
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
  return events;
}

function useLeaderboardRows() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!firebaseReady) return;
    return listenLeaderboard(setRows);
  }, []);
  return [...rows].sort((a, b) => (b.points || 0) - (a.points || 0));
}

function useRulebookText() {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!firebaseReady) return;
    return listenRulebook(setText);
  }, []);
  return text;
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

const VIDEOS = [
  { id: "v1", title: "Whitefield Winter Clash — Grand Final", dur: "4:12" },
  { id: "v2", title: "Judge's Cut: Burst Finish Rulings Explained", dur: "6:30" },
  { id: "v3", title: "Indiranagar Series #4 Highlights", dur: "3:47" },
  { id: "v4", title: "Launcher Tech: Pull-Speed Comparison", dur: "5:02" },
];

// Product taxonomy: what kind of item, its condition, and — only for
// Beyblades themselves — the gameplay archetype.
const ITEM_TYPES = ["Beyblade", "Stadium", "Launcher", "Parts"];
const CONDITIONS = ["NIB", "NIP", "Used"];
const BEYBLADE_CATEGORIES = ["Attack", "Defense", "Balance", "Stamina"];

/* ================= APP ================= */

export default function App() {
  const [nav, setNav] = useState(false);
  const [toast, fireToast] = useToast();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState(null);

  const { user, loading: authLoading, isAdmin, isSeller, blockedNotice, clearBlockedNotice } = useAuth();
  const [route, setRoute] = useState(readAuthRoute);
  const [page, setPage] = useState(readPage);

  const events = useEvents();
  const leaderboard = useLeaderboardRows();
  const rulebookText = useRulebookText();
  const myProfile = useMyProfile(user?.uid);

  const [approvedProducts, productsLoaded] = useApprovedProducts();
  const sellerProducts = useSellerProducts(isSeller ? user?.uid : null);
  const allProducts = useAllProducts(isAdmin);
  const allUsers = useAllUsers(isAdmin);
  const myOrders = useMyOrders(user?.uid);
  const sellerOrders = useSellerOrders(user?.uid, isSeller);

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

  return (
    <div
      style={{
        fontFamily: "'Inter', sans-serif",
        background: "#0A0D18",
        color: "#F4F2EC",
        minHeight: "100vh",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        @keyframes blade-spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes toast-in { from { opacity:0; transform: translate(-50%,12px);} to {opacity:1; transform: translate(-50%,0);} }
        @keyframes pop-in { from { opacity:0; transform: scale(0.7);} to {opacity:1; transform: scale(1);} }
        @keyframes auth-in { from { opacity:0; transform: translateY(14px);} to {opacity:1; transform: translateY(0);} }
        @keyframes glow-pulse { 0%,100% { opacity:0.5;} 50% { opacity:0.9;} }
        .disp { font-family:'Rajdhani',sans-serif; }
        .tap { transition: transform 200ms ${EASE}, opacity 150ms ${EASE}, filter 200ms ${EASE}; }
        .tap:active { transform: scale(0.96); opacity:0.85; }
        .lift { transition: transform 260ms ${EASE}, box-shadow 260ms ${EASE}, border-color 260ms ${EASE}; }
        .nav-link { position: relative; padding-bottom: 2px; }
        .nav-link::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: -4px; height: 2px;
          background: #00E6C3; border-radius: 1px; transform: scaleX(0); transform-origin: center;
          transition: transform 280ms ${EASE};
        }
        @media (hover: hover) {
          .tap:hover { filter: brightness(1.1); }
          .lift:hover { transform: translateY(-4px); box-shadow: 0 16px 30px rgba(0,0,0,0.35); border-color: #2A3050 !important; }
          .nav-link:hover::after { transform: scaleX(1); }
        }
        ::selection { background:#FF4425; color:#0A0D18; }
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
            rulebookText={rulebookText}
            fireToast={fireToast}
            users={allUsers}
          />
        </DashboardPage>
      ) : (
      <>

      {/* NAV */}
      <nav
        className="fixed top-0 left-0 right-0 z-40 px-5 md:px-10 flex items-center justify-between"
        style={{
          height: 64,
          background: nav ? "rgba(10,13,24,0.85)" : "transparent",
          backdropFilter: nav ? "blur(14px)" : "none",
          borderBottom: nav ? "1px solid #1C2136" : "1px solid transparent",
          transition: `all 400ms ${EASE}`,
        }}
      >
        <a href="#top" className="tap flex items-center gap-2.5">
          <img src={bbaLogo} alt="Bangalore Beyblade Association" width={34} height={34} style={{ display: "block" }} />
          {/* full name where there's room; the association's own BBA mark below that */}
          <span className="disp font-bold tracking-wide text-lg hidden lg:inline">
            BANGALORE BEYBLADE <span style={{ color: "#FF4425" }}>ASSOCIATION</span>
          </span>
          <span className="disp font-bold tracking-wide text-lg lg:hidden">BBA</span>
        </a>
        <div className="hidden md:flex items-center gap-7 text-sm" style={{ color: "#C7CCDA" }}>
          <a href="#events" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="events" /> Events
          </a>
          <a href="#videos" className="tap nav-link hover:text-white flex items-center gap-1.5">
            <Icon name="videos" /> Videos
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCartOpen(true)}
            className="tap relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "#FF4425", color: "#0A0D18" }}
          >
            <Icon name="cart" size={16} /> Cart
            {cartCount > 0 && (
              <span
                key={cartCount}
                className="absolute -top-2 -right-2 rounded-full flex items-center justify-center"
                style={{
                  width: 20,
                  height: 20,
                  background: "#00E6C3",
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
            style={{ background: "#1C2136", color: "#00E6C3", letterSpacing: 1 }}
          >
            BANGALORE · SEASON 3 NOW LIVE
          </div>
          <h1 className="disp font-bold leading-[0.95]" style={{ fontSize: "clamp(2.6rem,6vw,4.6rem)" }}>
            WHERE BANGALORE'S<br />
            <span style={{ color: "#FF4425" }}>BLADERS</span> COLLIDE.
          </h1>
          <p className="mt-5 max-w-md" style={{ color: "#9AA1B4" }}>
            Tournament schedules, live brackets, match footage and a
            marketplace built for the city's Beyblade X community — organized
            by bladers, judged to WBO standard.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="https://challonge.com/"
              target="_blank"
              rel="noreferrer"
              className="tap px-6 py-3 rounded-full font-semibold text-sm"
              style={{ background: "#FF4425", color: "#0A0D18" }}
            >
              View Live Bracket ↗
            </a>
            <a
              href="#market"
              className="tap px-6 py-3 rounded-full font-semibold text-sm border"
              style={{ borderColor: "#2A3050", color: "#F4F2EC" }}
            >
              Browse Marketplace
            </a>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <SpinningBey size={280} alt="Beyblade X top spinning" />
        </div>
      </header>

      {/* QUICK NAV — orients a first-time visitor to what's on this page */}
      <Reveal className="max-w-6xl mx-auto px-5 md:px-10 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["#events", "Events", "Every event, past and upcoming, with live brackets"],
            ["#videos", "Videos", "Match highlights and judge breakdowns"],
            ["#leaderboard", "Leaderboard", "Season 3 rankings across all events"],
            ["#market", "Shop", "Buy parts, or sell your own as an approved seller"],
          ].map(([href, title, desc]) => (
            <a
              key={href}
              href={href}
              className="tap lift p-4 rounded-2xl block"
              style={{ background: "#141827", border: "1px solid #1C2136" }}
            >
              <div className="disp font-semibold text-base" style={{ color: "#00E6C3" }}>{title}</div>
              <div className="text-xs mt-1" style={{ color: "#9AA1B4" }}>{desc}</div>
            </a>
          ))}
        </div>
      </Reveal>

      {/* STATS STRIP */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-6 pb-24">
        {[
          ["12", "Tournaments hosted"],
          ["310+", "Registered bladers"],
          ["4", "Bangalore regions"],
          ["1", "WBO-certified judge"],
        ].map(([n, l], i) => (
          <StatCard key={l} value={n} label={l} delay={i * 70} />
        ))}
      </div>

      {/* EVENTS */}
      <section id="events" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Tournament Events</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-2">Every event, past and upcoming — tap a bracket to open it live on Challonge.</p>
          <p className="text-xs mb-10" style={{ color: "#7A8194" }}>New to brackets? Challonge is a free third-party tool that runs the live match tree — you don't need an account to view it, only to compete.</p>
        </Reveal>
        {events.length === 0 ? (
          <p className="text-sm" style={{ color: "#7A8194" }}>No events posted yet — check back soon.</p>
        ) : (
        <div className="relative pl-8" style={{ borderLeft: "2px solid #1C2136" }}>
          {events.map((t, i) => (
            <Reveal key={t.id} delay={i * 80} className="relative mb-10 last:mb-0">
              <div
                className="absolute rounded-full"
                style={{ left: -37, top: 6, width: 14, height: 14, background: t.accent || "#FF4425", boxShadow: `0 0 0 4px #0A0D18` }}
              />
              <div className="lift p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: "#141827", border: "1px solid #1C2136" }}>
                <div
                  className="rounded-xl shrink-0 flex items-center justify-center"
                  style={{ width: 64, height: 64, background: "#1C2136" }}
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
                        color: t.status === "upcoming" ? "#00E6C3" : "#9AA1B4",
                      }}
                    >
                      {t.status === "upcoming" ? "Upcoming" : "Completed"}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#9AA1B4" }}>{t.date} · {t.venue}</p>
                  <p className="text-sm" style={{ color: "#7A8194" }}>{t.format}</p>
                </div>
                <a
                  href={t.bracketUrl || "https://challonge.com/"}
                  target="_blank"
                  rel="noreferrer"
                  className="tap px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap"
                  style={{ border: "1px solid #2A3050" }}
                >
                  Bracket ↗
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        )}
      </section>

      {/* VIDEOS */}
      <section id="videos" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Promo & Match Footage</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-10">Highlights, finals, and judge breakdowns from the circuit.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-6">
          {VIDEOS.map((v, i) => (
            <Reveal key={v.id} delay={i * 70}>
              <button
                onClick={() => fireToast("Connect a video source (YouTube/Drive) to play this")}
                className="tap lift w-full text-left rounded-2xl overflow-hidden"
                style={{ background: "#141827", border: "1px solid #1C2136" }}
              >
                <div
                  className="relative flex items-center justify-center"
                  style={{ height: 170, background: "linear-gradient(135deg,#1C2136,#0A0D18)" }}
                >
                  <div
                    className="rounded-full flex items-center justify-center"
                    style={{ width: 54, height: 54, background: "#FF4425" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="#0A0D18" /></svg>
                  </div>
                  <span className="absolute bottom-2 right-3 text-xs px-2 py-0.5 rounded" style={{ background: "#0A0D18CC" }}>{v.dur}</span>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-sm">{v.title}</h4>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LEADERBOARD */}
      <section id="leaderboard" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Season 3 Leaderboard</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-10">Points from all sanctioned Bangalore events, merged by ranking.</p>
        </Reveal>
        {leaderboard.length === 0 ? (
          <p className="text-sm" style={{ color: "#7A8194" }}>No standings posted yet.</p>
        ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: "#141827", border: "1px solid #1C2136" }}>
          {leaderboard.map((row, i) => (
            <Reveal key={row.id} delay={i * 50}>
              <div
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i ? "1px solid #1C2136" : "none" }}
              >
                <RankRing rank={i + 1} />
                <div className="flex-1">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs" style={{ color: "#7A8194" }}>{row.region}</div>
                </div>
                <div className="text-xs hidden sm:block" style={{ color: "#9AA1B4", fontFamily: "'JetBrains Mono',monospace" }}>{row.wins ?? 0}-{row.losses ?? 0}</div>
                <div className="disp font-bold text-lg" style={{ color: "#00E6C3", width: 70, textAlign: "right" }}>{row.points}</div>
              </div>
            </Reveal>
          ))}
        </div>
        )}
      </section>

      {/* RULEBOOK */}
      <section id="rulebook" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Rulebook</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-10">Judged to WBO standard, with Bangalore-specific additions below.</p>
        </Reveal>
        <div className="p-6 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
          {rulebookText ? (
            <p className="text-sm leading-relaxed" style={{ color: "#C7CCDA", whiteSpace: "pre-wrap" }}>{rulebookText}</p>
          ) : (
            <p className="text-sm" style={{ color: "#7A8194" }}>The rulebook hasn't been published yet.</p>
          )}
        </div>
      </section>

      {/* MARKETPLACE — buying only. Selling/administering live on their own
          dashboard pages, reached from the account menu. */}
      <section id="market" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Marketplace</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-6">Buy parts from approved sellers across Bangalore's Beyblade X community.</p>
        </Reveal>
        {!user && (
          <p className="text-xs mb-2" style={{ color: "#7A8194" }}>
            <button onClick={() => goAuth("login", "market")} className="tap font-semibold" style={{ color: "#00E6C3" }}>
              Sign in
            </button>{" "}
            to buy.
          </p>
        )}
        <div className="mt-6">
          <BuyerPanel products={approvedProducts} onAdd={addToCart} loaded={productsLoaded} />
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 text-center text-xs py-10" style={{ color: "#4A5070" }}>
        <img src={bbaLogo} alt="" width={72} height={72} style={{ display: "block", opacity: 0.85 }} />
        <p>
          Bangalore Beyblade Association — an independent community project for the
          city's Beyblade X scene. Not affiliated with TAKARA TOMY.
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
            background: "#141827",
            borderLeft: "1px solid #1C2136",
            transform: cartOpen ? "translateX(0)" : "translateX(100%)",
            transition: `transform 420ms ${EASE}`,
          }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1C2136" }}>
            <h3 className="disp font-semibold text-lg">Your Cart</h3>
            <button onClick={() => setCartOpen(false)} className="tap text-sm" style={{ color: "#9AA1B4" }}>Close</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {cart.length === 0 && <p style={{ color: "#7A8194" }} className="text-sm">Nothing here yet — add parts from the shop.</p>}
            {cart.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div style={{ color: "#7A8194" }}>Qty {i.qty}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{i.price * i.qty}</div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4" style={{ borderTop: "1px solid #1C2136" }}>
            <div className="flex justify-between mb-3 text-sm">
              <span style={{ color: "#9AA1B4" }}>Total</span>
              <span className="font-semibold" style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{cartTotal}</span>
            </div>
            {!user && cart.length > 0 && (
              <p className="text-xs mb-3" style={{ color: "#7A8194" }}>
                Sign in to place your order — we need somewhere to send it.
              </p>
            )}
            <button
              onClick={checkout}
              className="tap w-full py-3 rounded-full font-semibold text-sm"
              style={{ background: "#FF4425", color: "#0A0D18" }}
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
          <div className="relative w-full max-w-md rounded-2xl p-6" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <h3 className="disp font-bold text-xl mb-1">Order placed</h3>
            <p className="text-sm mb-5" style={{ color: "#9AA1B4" }}>
              Pay each seller directly, then they'll mark your order as paid.
            </p>
            <div className="space-y-3 mb-5">
              {checkoutResult.map((o) => (
                <div key={o.id} className="p-4 rounded-xl" style={{ background: "#0A0D18", border: "1px solid #2A3050" }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold">{o.sellerName}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{o.total}</span>
                  </div>
                  {o.sellerUpiId ? (
                    <p className="text-xs" style={{ color: "#00E6C3" }}>UPI: {o.sellerUpiId}</p>
                  ) : (
                    <p className="text-xs" style={{ color: "#7A8194" }}>No UPI on file —</p>
                  )}
                  {o.sellerPaymentContact && (
                    <p className="text-xs" style={{ color: "#9AA1B4" }}>Contact: {o.sellerPaymentContact}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setCheckoutResult(null)}
              className="tap w-full py-2.5 rounded-full text-sm font-semibold"
              style={{ background: "#FF4425", color: "#0A0D18" }}
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
            background: "#141827",
            borderLeft: "1px solid #1C2136",
            transform: ordersOpen ? "translateX(0)" : "translateX(100%)",
            transition: `transform 420ms ${EASE}`,
          }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #1C2136" }}>
            <h3 className="disp font-semibold text-lg">My Orders</h3>
            <button onClick={() => setOrdersOpen(false)} className="tap text-sm" style={{ color: "#9AA1B4" }}>Close</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {myOrders.length === 0 && <p style={{ color: "#7A8194" }} className="text-sm">No orders yet.</p>}
            {myOrders.map((o) => (
              <div key={o.id} className="p-4 rounded-xl" style={{ background: "#0A0D18", border: "1px solid #2A3050" }}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">{o.sellerName}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{o.total}</span>
                </div>
                <OrderStatusBadge status={o.status} />
                {o.status === "pending_payment" && o.sellerUpiId && (
                  <p className="text-xs mt-2" style={{ color: "#00E6C3" }}>Pay via UPI: {o.sellerUpiId}</p>
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
            background: "#1C2136",
            border: "1px solid #2A3050",
            animation: `toast-in 300ms ${EASE}`,
          }}
        >
          {toast}
        </div>
      )}
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
      <button onClick={onBack} className="tap text-sm mb-6 inline-block" style={{ color: "#7A8194" }}>
        ← Back to site
      </button>
      <h1 className="disp font-bold text-3xl mb-1 flex items-center gap-2.5">
        {icon && (
          <span
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 34, height: 34, background: "#00E6C31A", color: "#00E6C3" }}
          >
            <Icon name={icon} size={18} />
          </span>
        )}
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm mb-8" style={{ color: "#9AA1B4" }}>{subtitle}</p>
      )}
      {children}
    </div>
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
            background: active === k ? "#FF4425" : "#141827",
            color: active === k ? "#0A0D18" : "#9AA1B4",
            border: "1px solid #1C2136",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function fieldStyle() {
  return { background: "#0A0D18", border: "1px solid #2A3050", color: "#F4F2EC" };
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
          <div className="text-xs mb-1.5" style={{ color: "#7A8194" }}>Type</div>
          <TabStrip
            tabs={[["All", "All"], ...ITEM_TYPES.map((c) => [c, c])]}
            active={itemType}
            onChange={setItemType}
          />
        </div>
        <div>
          <div className="text-xs mb-1.5" style={{ color: "#7A8194" }}>Condition</div>
          <TabStrip
            tabs={[["All", "All"], ...CONDITIONS.map((c) => [c, c])]}
            active={condition}
            onChange={setCondition}
          />
        </div>
      </div>
      {!loaded ? (
        <p className="text-sm" style={{ color: "#7A8194" }}>Loading listings…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm" style={{ color: "#7A8194" }}>No listings match these filters yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((p, i) => (
            <Reveal key={p.id} delay={i * 40}>
              <div className="lift p-5 rounded-2xl flex flex-col gap-3" style={{ background: "#141827", border: "1px solid #1C2136" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs" style={{ color: "#7A8194" }}>{p.sellerName}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#00E6C31A", color: "#00E6C3" }}>{p.itemType}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#7A81941A", color: "#9AA1B4" }}>{p.condition}</span>
                  </div>
                </div>
                {p.itemType === "Beyblade" && p.beybladeCategory && (
                  <span className="text-xs" style={{ color: "#7A8194" }}>{p.beybladeCategory} type</span>
                )}
                <div className="flex items-center justify-between">
                  <span className="disp font-bold text-lg" style={{ fontFamily: "'JetBrains Mono',monospace" }}>₹{p.price}</span>
                  <span className="text-xs" style={{ color: "#7A8194" }}>{p.stock} in stock</span>
                </div>
                <button
                  onClick={() => onAdd(p)}
                  className="tap mt-1 py-2 rounded-full text-sm font-semibold"
                  style={{ background: "#FF4425", color: "#0A0D18" }}
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
            <p className="text-xs mb-3" style={{ color: "#7A8194" }}>
              Listing as <span style={{ color: "#00E6C3" }}>{seller?.name}</span>.
            </p>
            <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
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
              <button type="submit" className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
                Submit for approval
              </button>
            </form>
          </div>
          <div>
            <h3 className="font-semibold mb-4">My listings</h3>
            <div className="space-y-2">
              {products.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>No listings yet.</p>}
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs" style={{ color: "#7A8194" }}>₹{p.price} · {p.itemType} · {p.condition}</div>
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
          {orders.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>No sales yet.</p>}
          {orders.map((o) => (
            <div key={o.id} className="p-4 rounded-xl flex items-center justify-between flex-wrap gap-2" style={{ background: "#141827", border: "1px solid #1C2136" }}>
              <div>
                <div className="text-sm font-medium">{o.buyerName}</div>
                <div className="text-xs" style={{ color: "#7A8194" }}>{o.items.length} item(s) · ₹{o.total}</div>
                <OrderStatusBadge status={o.status} />
              </div>
              {o.status === "pending_payment" && (
                <button
                  onClick={() => onMarkPaid(o.id)}
                  className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "#00E6C3", color: "#0A0D18" }}
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
          style={{ background: "#141827", border: "1px solid #1C2136" }}
        >
          <p className="text-xs mb-1" style={{ color: "#7A8194" }}>
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
          <button type="submit" className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
            Save
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- admin ---------- */
function AdminPanel({ products, onDecide, events, leaderboard, rulebookText, fireToast, users }) {
  const [tab, setTab] = useState("listings");

  return (
    <div>
      <TabStrip
        tabs={[
          ["listings", "Listings"],
          ["roles", "Roles"],
          ["events", "Events"],
          ["leaderboard", "Leaderboard"],
          ["rulebook", "Rulebook"],
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "listings" && <AdminListings products={products} onDecide={onDecide} />}
      {tab === "roles" && <AdminRoles fireToast={fireToast} users={users} />}
      {tab === "events" && <AdminEvents events={events} fireToast={fireToast} />}
      {tab === "leaderboard" && <AdminLeaderboard rows={leaderboard} fireToast={fireToast} />}
      {tab === "rulebook" && <AdminRulebook text={rulebookText} fireToast={fireToast} />}
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
          <div key={l} className="p-4 rounded-xl text-center" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <div className="disp font-bold text-2xl" style={{ color: "#00E6C3" }}>{n}</div>
            <div className="text-xs" style={{ color: "#7A8194" }}>{l}</div>
          </div>
        ))}
      </div>
      <h3 className="font-semibold mb-3">Pending approvals</h3>
      {pending.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>Nothing waiting on review.</p>}
      <div className="space-y-2">
        {pending.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl flex-wrap gap-2" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <div>
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs" style={{ color: "#7A8194" }}>{p.sellerName} · ₹{p.price} · {p.itemType} · {p.condition}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onDecide(p.id, "approved")} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>Approve</button>
              <button onClick={() => onDecide(p.id, "rejected")} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: "transparent", border: "1px solid #2A3050", color: "#F4F2EC" }}>Reject</button>
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
        <p className="text-sm" style={{ color: "#7A8194" }}>
          {users.length === 0 ? "No one has signed in yet." : "No matches."}
        </p>
      ) : (
        <div className="rounded-2xl overflow-x-auto" style={{ background: "#141827", border: "1px solid #1C2136" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#7A8194", textAlign: "left" }}>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Name</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Email</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Last login</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Role</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.uid} style={{ borderTop: "1px solid #1C2136" }}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {u.name}
                    {u.uid === currentUser?.uid && (
                      <span className="ml-2 text-xs" style={{ color: "#7A8194" }}>(you)</span>
                    )}
                    {u.blocked && (
                      <span
                        className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#FF44251A", color: "#FF4425" }}
                      >
                        Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9AA1B4" }}>{u.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9AA1B4" }}>
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
                            background: u.role === r ? "#00E6C3" : "transparent",
                            color: u.role === r ? "#0A0D18" : "#9AA1B4",
                            border: u.role === r ? "none" : "1px solid #2A3050",
                          }}
                        >
                          <Icon name={r} size={13} /> {r}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.uid === currentUser?.uid ? (
                      <span className="text-xs" style={{ color: "#7A8194" }}>—</span>
                    ) : confirmUid === u.uid ? (
                      <div className="flex gap-1.5 flex-wrap items-center">
                        <span className="text-xs" style={{ color: "#FF9354" }}>Remove for good?</span>
                        <button
                          disabled={busyUid === u.uid}
                          onClick={() => remove(u)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{ background: "#FF4425", color: "#0A0D18" }}
                        >
                          <Icon name="remove" size={13} /> Confirm
                        </button>
                        <button
                          onClick={() => setConfirmUid(null)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ border: "1px solid #2A3050", color: "#9AA1B4" }}
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
                            background: u.blocked ? "#00E6C3" : "transparent",
                            color: u.blocked ? "#0A0D18" : "#FF9354",
                            border: u.blocked ? "none" : "1px solid #2A3050",
                          }}
                        >
                          <Icon name={u.blocked ? "unblock" : "block"} size={13} /> {u.blocked ? "Unblock" : "Block"}
                        </button>
                        <button
                          disabled={busyUid === u.uid}
                          onClick={() => setConfirmUid(u.uid)}
                          className="tap px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"
                          style={{ border: "1px solid #2A3050", color: "#FF6B5A" }}
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

function AdminEvents({ events, fireToast }) {
  const empty = { name: "", date: "", venue: "", format: "", status: "upcoming", bracketUrl: "", accent: "#FF4425" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

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
      <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
        <h3 className="font-semibold mb-1">{editingId ? "Edit event" : "New event"}</h3>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <input placeholder="Date (e.g. 12 Jan 2026)" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <input placeholder="Format (e.g. Double Elimination · 27 Bladers)" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <input placeholder="Bracket URL" value={form.bracketUrl} onChange={(e) => setForm({ ...form, bracketUrl: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()}>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className="tap flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
            {editingId ? "Save changes" : "Create event"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="tap px-4 rounded-full text-sm font-semibold" style={{ border: "1px solid #2A3050" }}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="space-y-2">
        {events.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>No events yet.</p>}
        {events.map((ev) => (
          <div key={ev.id} className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <div>
              <div className="text-sm font-medium">{ev.name}</div>
              <div className="text-xs" style={{ color: "#7A8194" }}>{ev.date} · {ev.status}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setForm({ ...empty, ...ev }); setEditingId(ev.id); }} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid #2A3050", color: "#F4F2EC" }}>Edit</button>
              <button onClick={() => deleteEvent(ev.id)} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid #2A3050", color: "#FF6B5A" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLeaderboard({ rows, fireToast }) {
  const empty = { name: "", region: "", points: "", wins: "", losses: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = {
      name: form.name,
      region: form.region,
      points: Number(form.points) || 0,
      wins: Number(form.wins) || 0,
      losses: Number(form.losses) || 0,
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

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
        <h3 className="font-semibold mb-1">{editingId ? "Edit standing" : "Add standing"}</h3>
        <input placeholder="Blader name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <input placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        <div className="flex gap-3">
          <input placeholder="Points" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
          <input placeholder="Wins" type="number" value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
          <input placeholder="Losses" type="number" value={form.losses} onChange={(e) => setForm({ ...form, losses: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={fieldStyle()} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="tap flex-1 py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
            {editingId ? "Save changes" : "Add"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="tap px-4 rounded-full text-sm font-semibold" style={{ border: "1px solid #2A3050" }}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>No standings yet.</p>}
        {rows.map((row) => (
          <div key={row.id} className="p-3 rounded-xl flex items-center justify-between gap-2" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <div>
              <div className="text-sm font-medium">{row.name}</div>
              <div className="text-xs" style={{ color: "#7A8194" }}>{row.points} pts · {row.wins ?? 0}-{row.losses ?? 0}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { setForm({ ...empty, ...row }); setEditingId(row.id); }} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid #2A3050", color: "#F4F2EC" }}>Edit</button>
              <button onClick={() => deleteLeaderboardEntry(row.id)} className="tap px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: "1px solid #2A3050", color: "#FF6B5A" }}>Delete</button>
            </div>
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
      <button onClick={save} className="tap px-5 py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
        Publish
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved: ["#00E6C3", "Live"],
    pending: ["#FFC240", "Pending"],
    rejected: ["#FF4425", "Rejected"],
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
    pending_payment: ["#FFC240", "Awaiting payment"],
    paid: ["#00E6C3", "Paid"],
    cancelled: ["#FF4425", "Cancelled"],
  };
  const [color, label] = map[status] || map.pending_payment;
  return (
    <span className="text-xs font-semibold px-2 py-1 rounded-full inline-block mt-1" style={{ background: color + "1A", color }}>
      {label}
    </span>
  );
}
