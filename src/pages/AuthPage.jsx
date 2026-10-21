import React, { useState } from "react";
import { useAuth } from "../auth/context";
import { goAuth } from "../lib/authRoute";
import { firebaseReady } from "../lib/firebase";
import beybladeImg from "../assets/beyblade.webp";
import bbaLogo from "../assets/bba-logo.webp";

const EASE = "cubic-bezier(0.32,0.72,0,1)";

const ERROR_MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account already exists with that email.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
};

function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || "Something went wrong. Please try again.";
}

// Google's own multicolor "G" mark — branding guidelines require using the
// logo as-is (no recoloring/distorting), so this is inlined rather than
// reusing the app's single-tone Icon set.
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-left mb-4">
      <span className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-dim)" }}>
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
        style={{
          background: "var(--bg)",
          border: "1px solid var(--border-strong)",
          color: "var(--text)",
        }}
      />
    </label>
  );
}

export default function AuthPage({ mode, next, onClose }) {
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (isSignup) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      // App.jsx's effect on `user` handles leaving this route + toast + next.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          animation: `auth-in 420ms ${EASE}`,
        }}
      >
        <div className="flex justify-center mb-4">
          <img
            src={beybladeImg}
            alt=""
            draggable="false"
            style={{ width: 64, height: 64, animation: "bey-wobble 2.6s ease-in-out infinite", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.4))" }}
          />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            <img
              src={bbaLogo}
              alt="Bangalore Beyblade Association"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <h1 className="disp text-2xl font-bold text-center">
            {isSignup ? "Create account" : "Sign in"}
          </h1>
        </div>
        <p className="text-sm mb-6 text-center" style={{ color: "var(--text-faint)" }}>
          {isSignup ? "Join the Bangalore Beyblade Association." : "Welcome back, blader."}
        </p>

        {!firebaseReady ? (
          <p
            className="text-sm text-center rounded-lg px-3.5 py-3 mb-2"
            style={{ background: "var(--bg)", border: "1px solid var(--border-strong)", color: "var(--bronze)" }}
          >
            Auth isn't configured yet — add Firebase project keys to .env (see .env.example) to
            enable sign-in.
          </p>
        ) : (
          <>
            <form onSubmit={submit}>
              {isSignup && (
                <Field
                  label="Name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <Field
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Field
                label="Password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />

              {error && (
                <p className="text-xs mb-4" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="tap w-full py-2.5 rounded-full text-sm font-semibold mb-3"
                style={{
                  background: "var(--accent2)",
                  color: "#0A0D18",
                  opacity: busy ? 0.6 : 1,
                  transition: `opacity 200ms ${EASE}`,
                }}
              >
                {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div style={{ flex: 1, height: 1, background: "var(--border-strong)" }} />
              <span className="text-xs" style={{ color: "var(--text-faint-2)" }}>
                or
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border-strong)" }} />
            </div>

            {/* Google's branding guidelines call for their own button
                treatment (white, their G mark, "Sign in/up with Google")
                rather than the app's own button styles — kept as-is
                regardless of light/dark theme, same as the official
                button assets. */}
            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="tap w-full py-2.5 rounded-full text-sm flex items-center justify-center gap-3"
              style={{
                background: "#fff",
                border: "1px solid #dadce0",
                color: "#3c4043",
                fontFamily: "Roboto, Arial, sans-serif",
                fontWeight: 500,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <GoogleLogo />
              {isSignup ? "Sign up with Google" : "Sign in with Google"}
            </button>
          </>
        )}

        <p className="text-sm text-center mt-6" style={{ color: "var(--text-faint)" }}>
          {isSignup ? "Already have an account? " : "New to BBA? "}
          <button
            type="button"
            onClick={() => goAuth(isSignup ? "login" : "signup", next)}
            className="tap font-semibold"
            style={{ color: "var(--accent-ink)" }}
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="tap block mx-auto mt-4 text-xs"
          style={{ color: "var(--text-faint-2)" }}
        >
          Back to site
        </button>
      </div>
    </div>
  );
}
