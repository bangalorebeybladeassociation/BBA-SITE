import { createContext, useContext } from "react";

/* ---------------------------------------------------------
   Shape AuthProvider supplies. user/loading/firestoreRole/
   isAdmin/isSeller are read by App.jsx; the action functions
   are used by AuthPage's forms.
--------------------------------------------------------- */
export const AuthContext = createContext({
  user: null,
  loading: false,
  firestoreRole: null,
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
