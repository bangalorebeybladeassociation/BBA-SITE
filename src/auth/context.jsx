import { createContext, useContext } from "react";

/* ---------------------------------------------------------
   Placeholder auth context — no real backend wired up yet.
   Shape matches what App.jsx expects: user/loading/role/
   setRole/isAdmin. AuthProvider supplies the real values.
--------------------------------------------------------- */
export const AuthContext = createContext({
  user: null,
  loading: false,
  role: "buyer",
  setRole: () => {},
  isAdmin: false,
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
