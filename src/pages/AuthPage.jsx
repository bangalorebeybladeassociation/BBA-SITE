import React, { useState } from "react";
import { useAuth } from "../auth/context";
import { goAuth } from "../lib/authRoute";
import { firebaseReady } from "../lib/firebase";

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

function Field({ label, ...props }) {
  return (
    <label className="block text-left mb-4">
      <span className="block text-xs font-semibold mb-1.5" style={{ color: "#9AA1B4" }}>
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
        style={{
          background: "#0A0D18",
          border: "1px solid #2A3050",
          color: "#F4F2EC",
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
      style={{ background: "#0A0D18", color: "#F4F2EC" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "#141827",
          border: "1px solid #1C2136",
          animation: `auth-in 420ms ${EASE}`,
        }}
      >
        <h1 className="disp text-2xl font-bold mb-1 text-center">
          {isSignup ? "Create account" : "Sign in"}
        </h1>
        <p className="text-sm mb-6 text-center" style={{ color: "#7A8194" }}>
          {isSignup ? "Join the Bangalore Beyblade Association." : "Welcome back, blader."}
        </p>

        {!firebaseReady ? (
          <p
            className="text-sm text-center rounded-lg px-3.5 py-3 mb-2"
            style={{ background: "#0A0D18", border: "1px solid #2A3050", color: "#FF9354" }}
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
                <p className="text-xs mb-4" style={{ color: "#FF6B5A" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="tap w-full py-2.5 rounded-full text-sm font-semibold mb-3"
                style={{
                  background: "#FF4425",
                  color: "#0A0D18",
                  opacity: busy ? 0.6 : 1,
                  transition: `opacity 200ms ${EASE}`,
                }}
              >
                {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div style={{ flex: 1, height: 1, background: "#2A3050" }} />
              <span className="text-xs" style={{ color: "#4A5070" }}>
                or
              </span>
              <div style={{ flex: 1, height: 1, background: "#2A3050" }} />
            </div>

            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="tap w-full py-2.5 rounded-full text-sm font-semibold"
              style={{
                background: "transparent",
                border: "1px solid #2A3050",
                color: "#F4F2EC",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Continue with Google
            </button>
          </>
        )}

        <p className="text-sm text-center mt-6" style={{ color: "#7A8194" }}>
          {isSignup ? "Already have an account? " : "New to BBA? "}
          <button
            type="button"
            onClick={() => goAuth(isSignup ? "login" : "signup", next)}
            className="tap font-semibold"
            style={{ color: "#00E6C3" }}
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="tap block mx-auto mt-4 text-xs"
          style={{ color: "#4A5070" }}
        >
          Back to site
        </button>
      </div>
    </div>
  );
}
