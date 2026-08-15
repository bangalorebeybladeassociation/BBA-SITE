import { createContext, useContext } from "react";

/* ---------------------------------------------------------
   Shape AuthProvider supplies. user/loading/role/setRole/
   isAdmin are read by App.jsx; the action functions are used
   by AuthPage's forms.
--------------------------------------------------------- */
export const AuthContext = createContext({
  user: null,
  loading: false,
  role: "buyer",
  setRole: () => {},
  firestoreRole: null,
  isAdmin: false,
  isSeller: false,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
