/* ---------------------------------------------------------
   Tiny query-string router for the Seller/Admin dashboards —
   same pattern as authRoute.js. ?page=seller|admin swaps the
   whole page in, reached from the account menu rather than an
   inline tab switcher.
--------------------------------------------------------- */
export const PAGE_EVENT = "bba:page-route-change";

export function readPage() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  return page === "seller" || page === "admin" ? page : null;
}

function setPageParam(page) {
  const params = new URLSearchParams(window.location.search);
  if (page) params.set("page", page);
  else params.delete("page");
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event(PAGE_EVENT));
}

export function goPage(page) {
  setPageParam(page);
}

export function leavePage() {
  setPageParam(null);
}
