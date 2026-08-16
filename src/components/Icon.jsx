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
  videos: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
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
