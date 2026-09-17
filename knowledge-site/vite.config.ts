import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sites } from "./build/sites-vite-plugin";

export default defineConfig({
  plugins: [react(), sites()],
  server: {
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
