import React, { useState, useEffect, useRef, useCallback } from "react";

/* ---------------------------------------------------------
   Storage fallback: window.storage is provided by the Claude
   artifact host. Outside that host (e.g. this standalone repo)
   fall back to localStorage so the app still works.
--------------------------------------------------------- */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(key);
      if (raw === null) throw new Error("not found");
      return { key, value: raw, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

/* ---------------------------------------------------------
   BLADE CITY BLR — Bangalore Beyblade tournament hub + shop
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

/* ---------- spin dial (signature element) ---------- */
function SpinDial({ size = 240, speed = 18, className = "" }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        animation: `blade-spin ${speed}s linear infinite`,
      }}
    >
      <svg viewBox="0 0 200 200" width="100%" height="100%">
        <circle cx="100" cy="100" r="92" fill="none" stroke="#2A3050" strokeWidth="2" />
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="#FF4425"
          strokeWidth="3"
          strokeDasharray="12 10"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="66" fill="none" stroke="#00E6C3" strokeWidth="1.5" opacity="0.5" />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const x1 = 100 + Math.cos(a) * 78,
            y1 = 100 + Math.sin(a) * 78;
          const x2 = 100 + Math.cos(a) * 88,
            y2 = 100 + Math.sin(a) * 88;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7A8194" strokeWidth="1.5" />
          );
        })}
        <circle cx="100" cy="100" r="34" fill="#141827" stroke="#FF4425" strokeWidth="2" />
        <polygon points="100,74 118,100 100,126 82,100" fill="#00E6C3" opacity="0.9" />
      </svg>
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

/* ================= DATA ================= */

const TOURNAMENTS = [
  {
    id: "t1",
    name: "Whitefield Winter Clash",
    date: "12 Jan 2026",
    venue: "Whitefield Community Hall",
    format: "Double Elimination · 27 Bladers",
    status: "Completed",
    accent: "#FF4425",
    bracketUrl: "https://challonge.com/",
  },
  {
    id: "t2",
    name: "Indiranagar Spin Series #4",
    date: "8 Mar 2026",
    venue: "Sports Arena, 100ft Road",
    format: "Swiss + Top Cut · 40 Bladers",
    status: "Completed",
    accent: "#00E6C3",
    bracketUrl: "https://challonge.com/",
  },
  {
    id: "t3",
    name: "Koramangala X-Open",
    date: "21 Jun 2026",
    venue: "Sportsdock, Koramangala",
    format: "Round Robin Pools · 32 Bladers",
    status: "Completed",
    accent: "#FFC240",
    bracketUrl: "https://challonge.com/",
  },
  {
    id: "t4",
    name: "Bangalore Regional Championship",
    date: "6 Sep 2026",
    venue: "TBA — Central Bangalore",
    format: "WBO-judged Double Elimination",
    status: "Upcoming",
    accent: "#FF4425",
    bracketUrl: "https://challonge.com/",
  },
];

const LEADERBOARD = [
  { rank: 1, name: "Aryan K.", region: "Whitefield", pts: 1420, wl: "38-6" },
  { rank: 2, name: "Zoya M.", region: "Indiranagar", pts: 1355, wl: "34-9" },
  { rank: 3, name: "Rehan S.", region: "Koramangala", pts: 1290, wl: "31-10" },
  { rank: 4, name: "Diya P.", region: "HSR Layout", pts: 1180, wl: "27-12" },
  { rank: 5, name: "Kabir V.", region: "Jayanagar", pts: 1120, wl: "25-13" },
  { rank: 6, name: "Sana R.", region: "Whitefield", pts: 1065, wl: "22-14" },
];

const VIDEOS = [
  { id: "v1", title: "Whitefield Winter Clash — Grand Final", dur: "4:12" },
  { id: "v2", title: "Judge's Cut: Burst Finish Rulings Explained", dur: "6:30" },
  { id: "v3", title: "Indiranagar Series #4 Highlights", dur: "3:47" },
  { id: "v4", title: "Launcher Tech: Pull-Speed Comparison", dur: "5:02" },
];

const SELLER_ME = { id: "seller-you", name: "You" };

const SEED_PRODUCTS = [
  { id: "p1", name: "Dran Sword 3-60F", price: 799, category: "Attack", stock: 12, sellerId: "seller-arjun", sellerName: "Arjun's Bey Depot", status: "approved" },
  { id: "p2", name: "Wizard Arrow 4-80B", price: 849, category: "Balance", stock: 7, sellerId: "seller-arjun", sellerName: "Arjun's Bey Depot", status: "approved" },
  { id: "p3", name: "Knight Shield 3-60GF", price: 899, category: "Defense", stock: 5, sellerId: "seller-priya", sellerName: "Priya Blade Hub", status: "approved" },
  { id: "p4", name: "X-Launcher Grip (Red)", price: 549, category: "Launcher", stock: 20, sellerId: "seller-priya", sellerName: "Priya Blade Hub", status: "approved" },
];

const CATS = ["All", "Attack", "Defense", "Balance", "Stamina", "Launcher"];

/* ================= APP ================= */

export default function App() {
  const [nav, setNav] = useState(false);
  const [toast, fireToast] = useToast();
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);

  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [loaded, setLoaded] = useState(false);
  const [role, setRole] = useState("buyer");

  useEffect(() => {
    const onScroll = () => setNav(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // load / seed shared marketplace data
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("marketplace:products", true);
        if (res && res.value) {
          setProducts(JSON.parse(res.value));
        } else {
          await window.storage.set("marketplace:products", JSON.stringify(SEED_PRODUCTS), true);
        }
      } catch (e) {
        // fall back to local seed silently
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = async (next) => {
    setProducts(next);
    try {
      await window.storage.set("marketplace:products", JSON.stringify(next), true);
    } catch (e) {
      /* ignore — demo still works locally */
    }
  };

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
        .disp { font-family:'Rajdhani',sans-serif; }
        .tap { transition: transform 150ms ${EASE}, opacity 150ms ${EASE}; }
        .tap:active { transform: scale(0.96); opacity:0.85; }
        ::selection { background:#FF4425; color:#0A0D18; }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

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
        <div className="flex items-center gap-2">
          <div style={{ width: 22, height: 22 }}>
            <svg viewBox="0 0 44 44" width="22" height="22">
              <circle cx="22" cy="22" r="20" fill="none" stroke="#FF4425" strokeWidth="3" />
              <polygon points="22,12 30,22 22,32 14,22" fill="#00E6C3" />
            </svg>
          </div>
          <span className="disp font-bold tracking-wide text-lg">BLADE CITY <span style={{ color: "#FF4425" }}>BLR</span></span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm" style={{ color: "#C7CCDA" }}>
          <a href="#timeline" className="tap hover:text-white">Timeline</a>
          <a href="#videos" className="tap hover:text-white">Videos</a>
          <a href="#leaderboard" className="tap hover:text-white">Leaderboard</a>
          <a href="#market" className="tap hover:text-white">Shop</a>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="tap relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: "#FF4425", color: "#0A0D18" }}
        >
          Cart
          {cartCount > 0 && (
            <span
              className="absolute -top-2 -right-2 rounded-full flex items-center justify-center"
              style={{ width: 20, height: 20, background: "#00E6C3", color: "#0A0D18", fontSize: 11, fontWeight: 700 }}
            >
              {cartCount}
            </span>
          )}
        </button>
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
          <SpinDial size={280} />
        </div>
      </header>

      {/* QUICK NAV — orients a first-time visitor to what's on this page */}
      <Reveal className="max-w-6xl mx-auto px-5 md:px-10 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["#timeline", "Timeline", "Every event, past and upcoming, with live brackets"],
            ["#videos", "Videos", "Match highlights and judge breakdowns"],
            ["#leaderboard", "Leaderboard", "Season 3 rankings across all events"],
            ["#market", "Shop", "Buy parts, or sell your own as an approved seller"],
          ].map(([href, title, desc]) => (
            <a
              key={href}
              href={href}
              className="tap p-4 rounded-2xl block"
              style={{ background: "#141827", border: "1px solid #1C2136" }}
            >
              <div className="disp font-semibold text-base" style={{ color: "#00E6C3" }}>{title}</div>
              <div className="text-xs mt-1" style={{ color: "#9AA1B4" }}>{desc}</div>
            </a>
          ))}
        </div>
      </Reveal>

      {/* STATS STRIP */}
      <Reveal className="max-w-6xl mx-auto px-5 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-6 pb-24">
        {[
          ["12", "Tournaments hosted"],
          ["310+", "Registered bladers"],
          ["4", "Bangalore regions"],
          ["1", "WBO-certified judge"],
        ].map(([n, l]) => (
          <div key={l} className="p-5 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
            <div className="disp font-bold" style={{ fontSize: 34, color: "#00E6C3" }}>{n}</div>
            <div className="text-sm mt-1" style={{ color: "#9AA1B4" }}>{l}</div>
          </div>
        ))}
      </Reveal>

      {/* TIMELINE */}
      <section id="timeline" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Tournament Timeline</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-2">Every event, past and upcoming — tap a bracket to open it live on Challonge.</p>
          <p className="text-xs mb-10" style={{ color: "#7A8194" }}>New to brackets? Challonge is a free third-party tool that runs the live match tree — you don't need an account to view it, only to compete.</p>
        </Reveal>
        <div className="relative pl-8" style={{ borderLeft: "2px solid #1C2136" }}>
          {TOURNAMENTS.map((t, i) => (
            <Reveal key={t.id} delay={i * 80} className="relative mb-10 last:mb-0">
              <div
                className="absolute rounded-full"
                style={{ left: -37, top: 6, width: 14, height: 14, background: t.accent, boxShadow: `0 0 0 4px #0A0D18` }}
              />
              <div className="p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: "#141827", border: "1px solid #1C2136" }}>
                <div
                  className="rounded-xl shrink-0 flex items-center justify-center"
                  style={{ width: 64, height: 64, background: "#1C2136" }}
                >
                  <SpinDial size={40} speed={i % 2 ? 10 : 14} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="disp font-semibold text-xl">{t.name}</h3>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: t.status === "Upcoming" ? "#00E6C31A" : "#7A81941A",
                        color: t.status === "Upcoming" ? "#00E6C3" : "#9AA1B4",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "#9AA1B4" }}>{t.date} · {t.venue}</p>
                  <p className="text-sm" style={{ color: "#7A8194" }}>{t.format}</p>
                </div>
                <a
                  href={t.bracketUrl}
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
                className="tap w-full text-left rounded-2xl overflow-hidden"
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
        <div className="rounded-2xl overflow-hidden" style={{ background: "#141827", border: "1px solid #1C2136" }}>
          {LEADERBOARD.map((row, i) => (
            <Reveal key={row.rank} delay={i * 50}>
              <div
                className="flex items-center gap-4 px-5 py-4"
                style={{ borderTop: i ? "1px solid #1C2136" : "none" }}
              >
                <RankRing rank={row.rank} />
                <div className="flex-1">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs" style={{ color: "#7A8194" }}>{row.region}</div>
                </div>
                <div className="text-xs hidden sm:block" style={{ color: "#9AA1B4", fontFamily: "'JetBrains Mono',monospace" }}>{row.wl}</div>
                <div className="disp font-bold text-lg" style={{ color: "#00E6C3", width: 70, textAlign: "right" }}>{row.pts}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* MARKETPLACE */}
      <section id="market" className="max-w-6xl mx-auto px-5 md:px-10 py-16">
        <Reveal>
          <h2 className="disp font-bold text-3xl mb-2">Marketplace</h2>
          <p style={{ color: "#9AA1B4" }} className="mb-6">Demo of the buyer, seller and admin experience — data is shared and stored live for this artifact.</p>
        </Reveal>

        <RoleTabs role={role} setRole={setRole} />
        <p className="text-sm mt-3 mb-2" style={{ color: "#9AA1B4" }}>
          {role === "buyer" && "Browse parts approved sellers have listed, and add them to your cart."}
          {role === "seller" && "List parts for sale. New listings go to the admin for approval before buyers can see them."}
          {role === "admin" && "Review and approve or reject listings before they go live in the shop."}
        </p>

        <div className="mt-6">
          {role === "buyer" && (
            <BuyerPanel products={products.filter((p) => p.status === "approved")} onAdd={addToCart} loaded={loaded} />
          )}
          {role === "seller" && (
            <SellerPanel
              products={products}
              onCreate={(p) => {
                const next = [...products, p];
                persist(next);
                fireToast("Listing submitted for admin approval");
              }}
            />
          )}
          {role === "admin" && (
            <AdminPanel
              products={products}
              onDecide={(id, status) => {
                const next = products.map((p) => (p.id === id ? { ...p, status } : p));
                persist(next);
                fireToast(status === "approved" ? "Listing approved" : "Listing rejected");
              }}
            />
          )}
        </div>
      </section>

      <footer className="text-center text-xs py-10" style={{ color: "#4A5070" }}>
        Blade City BLR — an independent Bangalore Beyblade X community project. Not affiliated with TAKARA TOMY.
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
            <button
              onClick={() => {
                if (!cart.length) return;
                setCart([]);
                setCartOpen(false);
                fireToast("Order placed (demo checkout)");
              }}
              className="tap w-full py-3 rounded-full font-semibold text-sm"
              style={{ background: "#FF4425", color: "#0A0D18" }}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

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

/* ---------- role tabs ---------- */
function RoleTabs({ role, setRole }) {
  const tabs = [
    ["buyer", "Buyer"],
    ["seller", "Seller"],
    ["admin", "Admin"],
  ];
  return (
    <div className="inline-flex p-1 rounded-full" style={{ background: "#141827", border: "1px solid #1C2136" }}>
      {tabs.map(([k, label]) => (
        <button
          key={k}
          onClick={() => setRole(k)}
          className="tap px-5 py-2 rounded-full text-sm font-semibold relative"
          style={{
            color: role === k ? "#0A0D18" : "#9AA1B4",
            background: role === k ? "#00E6C3" : "transparent",
            transition: `all 300ms ${EASE}`,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------- buyer ---------- */
function BuyerPanel({ products, onAdd, loaded }) {
  const [cat, setCat] = useState("All");
  const shown = cat === "All" ? products : products.filter((p) => p.category === cat);
  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-6">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="tap px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: cat === c ? "#FF4425" : "#141827",
              color: cat === c ? "#0A0D18" : "#9AA1B4",
              border: "1px solid #1C2136",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {!loaded ? (
        <p className="text-sm" style={{ color: "#7A8194" }}>Loading listings…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm" style={{ color: "#7A8194" }}>No listings in this category yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((p, i) => (
            <Reveal key={p.id} delay={i * 40}>
              <div className="p-5 rounded-2xl flex flex-col gap-3" style={{ background: "#141827", border: "1px solid #1C2136" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs" style={{ color: "#7A8194" }}>{p.sellerName}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#00E6C31A", color: "#00E6C3" }}>{p.category}</span>
                </div>
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
function SellerPanel({ products, onCreate }) {
  const mine = products.filter((p) => p.sellerId === SELLER_ME.id);
  const [form, setForm] = useState({ name: "", price: "", category: "Attack", stock: "" });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    onCreate({
      id: "p" + Date.now(),
      name: form.name,
      price: Number(form.price),
      category: form.category,
      stock: Number(form.stock) || 1,
      sellerId: SELLER_ME.id,
      sellerName: SELLER_ME.name,
      status: "pending",
    });
    setForm({ name: "", price: "", category: "Attack", stock: "" });
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="font-semibold mb-4">List a new part</h3>
        <form onSubmit={submit} className="space-y-3 p-5 rounded-2xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
          <input
            placeholder="Part name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "#0A0D18", border: "1px solid #2A3050", color: "#F4F2EC" }}
          />
          <div className="flex gap-3">
            <input
              placeholder="Price ₹"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "#0A0D18", border: "1px solid #2A3050", color: "#F4F2EC" }}
            />
            <input
              placeholder="Stock"
              type="number"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "#0A0D18", border: "1px solid #2A3050", color: "#F4F2EC" }}
            />
          </div>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "#0A0D18", border: "1px solid #2A3050", color: "#F4F2EC" }}
          >
            {CATS.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
          </select>
          <button type="submit" className="tap w-full py-2.5 rounded-full text-sm font-semibold" style={{ background: "#00E6C3", color: "#0A0D18" }}>
            Submit for approval
          </button>
        </form>
      </div>
      <div>
        <h3 className="font-semibold mb-4">My listings</h3>
        <div className="space-y-2">
          {mine.length === 0 && <p className="text-sm" style={{ color: "#7A8194" }}>No listings yet.</p>}
          {mine.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: "#141827", border: "1px solid #1C2136" }}>
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs" style={{ color: "#7A8194" }}>₹{p.price} · {p.category}</div>
              </div>
              <StatusBadge status={p.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- admin ---------- */
function AdminPanel({ products, onDecide }) {
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
              <div className="text-xs" style={{ color: "#7A8194" }}>{p.sellerName} · ₹{p.price} · {p.category}</div>
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
