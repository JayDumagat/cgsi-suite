import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import svgr from "vite-plugin-svgr";

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": "/src",
      "@cgsi/contracts": fileURLToPath(
        new URL("../../packages/contracts/src", import.meta.url),
      ),
      "@cgsi/ui": fileURLToPath(
        new URL("../../packages/ui/src", import.meta.url),
      ),
      "react/jsx-runtime": require.resolve("react/jsx-runtime"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080",
    },
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))],
    },
  },
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  build: {
    rolldownOptions: {
      onwarn(warning, warn) {
        // Skip eval warnings from react-jvectormap
        if (
          warning.code === "EVAL" &&
          warning.id?.includes("@react-jvectormap")
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
