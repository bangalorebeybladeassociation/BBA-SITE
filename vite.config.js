import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the custom domain (bangaloreba.com) via public/CNAME, so
// assets resolve from the site root rather than a /<repo-name>/ subpath.
export default defineConfig({
  plugins: [react()],
  base: "/",
});
