/* ---------------------------------------------------------
   Tiny query-string router for the auth view.
   ?auth=login|signup drives AuthPage; ?next= says where to
   land after a successful sign-in (e.g. "cart", "market").
--------------------------------------------------------- */
export const ROUTE_EVENT = "bba:auth-route-change";

export function readAuthRoute() {
  if (typeof window === "undefined") return { mode: null, next: null };
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("auth");
  return {
    mode: mode === "login" || mode === "signup" ? mode : null,
    next: params.get("next"),
  };
}

function setRoute(mode, next) {
  const params = new URLSearchParams(window.location.search);
  if (mode) params.set("auth", mode);
  else params.delete("auth");
  if (next) params.set("next", next);
  else params.delete("next");
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

export function goAuth(mode, next) {
  setRoute(mode, next);
}

export function leaveAuth() {
  setRoute(null, null);
}
