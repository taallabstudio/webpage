import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "taallab-non-blocking-css",
      transformIndexHtml: {
        order: "post",
        handler(html) {
          // Keep the inline boot skeleton as the first paint, then apply the
          // compiled stylesheet as soon as its preload finishes. A noscript
          // stylesheet preserves styling when JavaScript is disabled.
          return html.replace(
            /<link rel="stylesheet"([^>]*href="([^"]+\.css)"[^>]*)>/g,
            (_tag, attrs) =>
              `<link rel="preload" as="style"${attrs} onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet"${attrs}></noscript>`
          );
        }
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin/index.html"),
        upload: resolve(__dirname, "admin/upload/index.html"),
        notFound: resolve(__dirname, "404.html"),
        ocean: resolve(__dirname, "ocean.html")
      }
    }
  },
  server: { port: 5173 }
});
