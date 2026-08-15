import React from "react";
import { useAuth } from "../auth/context";
import { goAuth } from "../lib/authRoute";

/* ---------------------------------------------------------
   Placeholder account menu: since AuthProvider never signs
   anyone in yet, this always renders the "Sign in" entry
   point. onSignedOut is unused until real auth lands.
--------------------------------------------------------- */
export default function AccountMenu({ onSignedOut }) {
  const { user } = useAuth();

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
    <button
      onClick={onSignedOut}
      className="tap px-4 py-2 rounded-full text-sm font-semibold"
      style={{ background: "transparent", border: "1px solid #2A3050", color: "#F4F2EC" }}
    >
      {user.name}
    </button>
  );
}
