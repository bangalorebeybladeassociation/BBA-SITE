import { createContext, useContext } from "react";

/* ---------------------------------------------------------
   Shape AuthProvider supplies. user/loading/firestoreRoles/
   isAdmin/isSeller are read by App.jsx; the action functions
   are used by AuthPage's forms. firestoreRoles is an array —
   a user can hold more than one role (e.g. admin and seller).
--------------------------------------------------------- */
export const AuthContext = createContext({
  user: null,
  loading: false,
  firestoreRoles: [],
  isAdmin: false,
  isSeller: false,
  blockedNotice: false,
  clearBlockedNotice: () => {},
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
