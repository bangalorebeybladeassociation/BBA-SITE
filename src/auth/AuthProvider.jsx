import React, { useMemo, useState } from "react";
import { AuthContext } from "./context";

/* ---------------------------------------------------------
   Placeholder provider: nobody is ever signed in yet. Keeps
   the app compiling and browsable while the real sign-in
   flow (Google/email, Firebase) is wired up separately.
--------------------------------------------------------- */
export default function AuthProvider({ children }) {
  const [role, setRole] = useState("buyer");

  const value = useMemo(
    () => ({
      user: null,
      loading: false,
      role,
      setRole,
      isAdmin: false,
      signOut: () => {},
    }),
    [role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
