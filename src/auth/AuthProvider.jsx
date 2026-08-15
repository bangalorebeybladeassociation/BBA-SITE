import React, { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { AuthContext } from "./context";
import { auth, firebaseReady, googleProvider, isAdminEmail } from "../lib/firebase";

function toAppUser(fbUser) {
  if (!fbUser) return null;
  return {
    uid: fbUser.uid,
    name: fbUser.displayName || fbUser.email,
    email: fbUser.email,
    photoURL: fbUser.photoURL,
  };
}

/* ---------------------------------------------------------
   Wires the app to Firebase Auth. If no Firebase config is
   present (see .env.example), auth is disabled and everyone
   stays signed out — the site still renders, sign-in just
   won't work until a project is configured.
--------------------------------------------------------- */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseReady);
  const [role, setRole] = useState("buyer");

  useEffect(() => {
    if (!firebaseReady) return;
    return onAuthStateChanged(auth, (fbUser) => {
      setUser(toAppUser(fbUser));
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      role,
      setRole,
      isAdmin: isAdminEmail(user?.email),
      async signUp(name, email, password) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        setUser(toAppUser({ ...cred.user, displayName: name || cred.user.displayName }));
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle() {
        await signInWithPopup(auth, googleProvider);
      },
      async signOutUser() {
        await signOut(auth);
      },
    }),
    [user, loading, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
