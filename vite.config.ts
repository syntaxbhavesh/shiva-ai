
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Detect Vercel deployment.
const isVercel =
  process.env["VERCEL"] === "1" ||
  Boolean(process.env["VERCEL_ENV"]);

// Load local .env secrets only during local development.
// Vercel environment variables are configured in the Vercel dashboard.
if (!isVercel) {
  const mode =
    process.env["NODE_ENV"] === "production"
      ? "production"
      : "development";

  const localEnv = loadEnv(mode, process.cwd(), "");

  for (const [key, value] of Object.entries(localEnv)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export default defineConfig({
  // The Lovable wrapper already registers TanStack Start.
  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  // Do not register Nitro separately.
  // Use the Vercel preset only when deploying to Vercel.
  ...(isVercel
    ? {
        nitro: {
          preset: "vercel",
        },
      }
    : {}),
});
