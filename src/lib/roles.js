/* ---------------------------------------------------------
   A user can hold more than one role at once (e.g. admin *and*
   seller) — roles (an array) is the current shape. role (a single
   string) is the legacy shape from before multi-role support; read
   it as a one-item array so an account that hasn't been touched
   since then still works, matching firestore.rules' rolesOf().
--------------------------------------------------------- */
export function rolesOf(profile) {
  if (!profile) return [];
  if (profile.roles) return profile.roles;
  return profile.role && profile.role !== "user" ? [profile.role] : [];
}
