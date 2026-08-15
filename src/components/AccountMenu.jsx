import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/context";
import { goAuth } from "../lib/authRoute";

export default function AccountMenu({ onSignedOut, onOpenOrders }) {
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (!user) {
    return (
      <button
        onClick={() => goAuth("login")}
        className="tap px-4 py-2 rounded-full text-sm font-semibold"
        style={{ background: "transparent", border: "1px solid #2A3050", color: "#F4F2EC" }}
      >
        Sign in
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-sm font-semibold"
        style={{ background: "transparent", border: "1px solid #2A3050", color: "#F4F2EC" }}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            width={24}
            height={24}
            style={{ borderRadius: "50%", display: "block" }}
          />
        ) : (
          <span
            className="flex items-center justify-center rounded-full font-bold"
            style={{ width: 24, height: 24, background: "#00E6C3", color: "#0A0D18", fontSize: 11 }}
          >
            {user.name?.[0]?.toUpperCase() || "?"}
          </span>
        )}
        {user.name}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl overflow-hidden"
          style={{ background: "#141827", border: "1px solid #1C2136", minWidth: 160, zIndex: 50 }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onOpenOrders?.();
            }}
            className="tap w-full text-left px-4 py-2.5 text-sm"
            style={{ color: "#F4F2EC", borderBottom: "1px solid #1C2136" }}
          >
            My orders
          </button>
          <button
            onClick={async () => {
              setOpen(false);
              await signOutUser();
              onSignedOut?.();
            }}
            className="tap w-full text-left px-4 py-2.5 text-sm"
            style={{ color: "#F4F2EC" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
