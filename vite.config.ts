// The Lovable wrapper already registers TanStack Start, React, Tailwind and Nitro.
// Do not register those plugins a second time.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Load local, unprefixed server secrets for local development only.
// Production secrets are supplied by the hosting platform.
const fileEnv = loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), "");
for (const [key, value] of Object.entries(fileEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

// The wrapper's default Nitro target is Cloudflare. Explicitly select Vercel
// when Vercel builds this project so API routes run as Vercel Functions.
const isVercel = Boolean(process.env["VERCEL"]);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: isVercel ? { preset: "vercel" } : true,
});
