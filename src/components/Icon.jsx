import React from "react";

/* ---------------------------------------------------------
   Small hand-drawn stroke icons — no icon library needed for
   this few glyphs. Shared between App.jsx (nav, role buttons)
   and AccountMenu.jsx (dashboard links).
--------------------------------------------------------- */
const ICON_PATHS = {
  events: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </>
  ),
  media: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
    </>
  ),
  gallery: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.7" />
      <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19" />
    </>
  ),
  leaderboard: (
    <>
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4.5A1.5 1.5 0 0 0 3 7.5 3.5 3.5 0 0 0 6.5 11H7M17 6h2.5A1.5 1.5 0 0 1 21 7.5 3.5 3.5 0 0 1 17.5 11H17" />
      <path d="M12 15v3M9 21h6M9.5 18h5l.5 3H9z" />
    </>
  ),
  rulebook: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16M8 8h8M8 11.5h8" />
    </>
  ),
  shop: (
    <>
      <path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  cart: (
    <>
      <circle cx="9.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <path d="M2.5 3.5h2.5l2.3 12a1.8 1.8 0 0 0 1.8 1.5h8.4a1.8 1.8 0 0 0 1.8-1.5l1.4-7.7H6.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.3" />
      <path d="M5 20c0-4 3-6.3 7-6.3s7 2.3 7 6.3" />
    </>
  ),
  seller: (
    <>
      <path d="M20.4 11.4L12.6 3.6H4v8.6l7.8 7.8a1.6 1.6 0 0 0 2.2 0l6.4-6.4a1.6 1.6 0 0 0 0-2.2z" />
      <circle cx="8.2" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  admin: (
    <>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  block: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M6.2 6.2l11.6 11.6" />
    </>
  ),
  unblock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.3l2.3 2.3 4.7-4.7" />
    </>
  ),
  remove: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4.8c0-.4.4-.8.9-.8h4.2c.5 0 .9.4.9.8V7" />
      <path d="M6 7l.8 12.2c0 1 .8 1.8 1.8 1.8h6.8c1 0 1.8-.8 1.8-1.8L18 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.5l1-1a3.8 3.8 0 0 1 5.5 5.5l-1.5 1.5" />
      <path d="M13 17.5l-1 1a3.8 3.8 0 0 1-5.5-5.5l1.5-1.5" />
    </>
  ),
  format: (
    <>
      <path d="M4 6h16M4 12h10M4 18h13" />
      <circle cx="19" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  flag: (
    <>
      <path d="M5 3v18" />
      <path d="M5 4h11l-2.2 3.5L16 11H5" />
    </>
  ),
  phone: (
    <>
      <path d="M6.5 3.5h3l1.3 4.2-2 1.6a12 12 0 0 0 5.9 5.9l1.6-2 4.2 1.3v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 5 5.1a1.5 1.5 0 0 1 1.5-1.6z" />
    </>
  ),
  blade: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 4.5v2.2M12 17.3v2.2M19.5 12h-2.2M6.7 12H4.5M17.1 6.9l-1.6 1.6M8.5 15.5l-1.6 1.6M17.1 17.1l-1.6-1.6M8.5 8.5L6.9 6.9" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="1.8" />
      <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="8" r="0.2" fill="currentColor" stroke="currentColor" strokeWidth="2.2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2z" />
    </>
  ),
  wallet: (
    <>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h11a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 17 19H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M14.5 12.5h3.5a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-3.5a1.75 1.75 0 0 1 0-3.5z" />
      <path d="M3.5 9.5h15" />
    </>
  ),
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0 }}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
