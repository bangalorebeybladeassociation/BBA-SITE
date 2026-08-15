import React from "react";

/* ---------------------------------------------------------
   Placeholder sign-in/sign-up screen. Real auth (Google/
   email, Firebase) isn't wired up yet — this just keeps the
   ?auth=login|signup route from crashing the app.
--------------------------------------------------------- */
export default function AuthPage({ mode, next, onClose }) {
  const title = mode === "signup" ? "Create account" : "Sign in";
  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "#0A0D18", color: "#F4F2EC" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 text-center"
        style={{ background: "#141827", border: "1px solid #1C2136" }}
      >
        <h1 className="disp text-2xl font-bold mb-2">{title}</h1>
        <p className="text-sm mb-6" style={{ color: "#7A8194" }}>
          This part of BBA is still being built{next ? ` — you'll land on "${next}" once it's ready` : ""}.
        </p>
        <button
          onClick={onClose}
          className="tap px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{ background: "#FF4425", color: "#0A0D18" }}
        >
          Back to site
        </button>
      </div>
    </div>
  );
}
