import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/context";
import { goAuth } from "../lib/authRoute";
import { goPage } from "../lib/pageRoute";
import Icon from "./Icon";

export default function AccountMenu({ onSignedOut, onOpenOrders }) {
  const { user, signOutUser, isSeller, isAdmin } = useAuth();
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
        style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}
      >
        Sign in
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap flex items-center gap-2 pl-2 pr-2 sm:pr-3 py-1.5 rounded-full text-sm font-semibold"
        style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}
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
            className="flex items-center justify-center rounded-full font-bold shrink-0"
            style={{ width: 24, height: 24, background: "var(--accent)", color: "#0A0D18", fontSize: 11 }}
          >
            {user.name?.[0]?.toUpperCase() || "?"}
          </span>
        )}
        <span className="hidden sm:inline whitespace-nowrap">{user.name}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 rounded-xl overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minWidth: 160,
            zIndex: 50,
            transformOrigin: "top right",
            animation: "pop-in 180ms cubic-bezier(0.32,0.72,0,1)",
          }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onOpenOrders?.();
            }}
            className="tap w-full text-left px-4 py-2.5 text-sm"
            style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}
          >
            My orders
          </button>
          {isSeller && (
            <button
              onClick={() => {
                setOpen(false);
                goPage("seller");
              }}
              className="tap w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
              style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}
            >
              <Icon name="seller" /> Seller dashboard
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setOpen(false);
                goPage("admin");
              }}
              className="tap w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
              style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}
            >
              <Icon name="admin" /> Admin dashboard
            </button>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              await signOutUser();
              onSignedOut?.();
            }}
            className="tap w-full text-left px-4 py-2.5 text-sm"
            style={{ color: "var(--text)" }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
