import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { listenUserProfile, upsertUserProfile } from "../lib/firestore";

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
  const [firestoreRole, setFirestoreRole] = useState(null);
  const [blockedNotice, setBlockedNotice] = useState(false);

  // While signUp() is applying a display name, the auth-state listener can
  // fire first with the name still unset — skip that intermediate event so
  // downstream effects (e.g. the "Signed in as ..." toast) see the final name.
  const pendingName = useRef(null);
  // Tracks the current users/{uid} profile listener so it can be torn down
  // when the signed-in user changes or signs out.
  const profileUnsub = useRef(null);

  useEffect(() => {
    if (!firebaseReady) return;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && pendingName.current && !fbUser.displayName) return;
      setUser(toAppUser(fbUser));
      setLoading(false);

      if (profileUnsub.current) {
        profileUnsub.current();
        profileUnsub.current = null;
      }
      if (fbUser) {
        upsertUserProfile(fbUser).then(() => {
          profileUnsub.current = listenUserProfile(fbUser.uid, (profile) => {
            if (profile?.blocked) {
              signOut(auth);
              setBlockedNotice(true);
              return;
            }
            setFirestoreRole(profile?.role || "user");
          });
        });
      } else {
        setFirestoreRole(null);
      }
    });
    return () => {
      unsubAuth();
      if (profileUnsub.current) profileUnsub.current();
    };
  }, []);

  const isAdmin = isAdminEmail(user?.email) || firestoreRole === "admin";
  const isSeller = firestoreRole === "seller" || isAdmin;

  const value = useMemo(
    () => ({
      user,
      loading,
      firestoreRole,
      isAdmin,
      isSeller,
      blockedNotice,
      clearBlockedNotice() {
        setBlockedNotice(false);
      },
      async signUp(name, email, password) {
        pendingName.current = name || null;
        try {
          const cred = await createUserWithEmailAndPassword(auth, email, password);
          if (name) await updateProfile(cred.user, { displayName: name });
          setUser(toAppUser(cred.user));
          setLoading(false);
        } finally {
          pendingName.current = null;
        }
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
    [user, loading, firestoreRole, isAdmin, isSeller, blockedNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
