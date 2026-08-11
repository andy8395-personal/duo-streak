import type { CapacitorConfig } from "@capacitor/cli";

// This app is server-rendered (TanStack Start + Nitro), so the native shell
// loads the hosted production URL rather than bundling a static build.
// During local development it points at the local dev server instead —
// swap PROD_URL in before archiving a release build.
const PROD_URL = process.env.CAPACITOR_PROD_URL; // set once the app is deployed, see AGENTS.md
// The Android emulator runs in its own virtual network, where "localhost"
// means the emulator itself, not the host Mac — 10.0.2.2 is its special
// alias for the host's loopback. Run `CAP_DEV_HOST=10.0.2.2 npx cap sync
// android` (and plain `npx cap sync ios`) so each platform's bundled config
// gets the right value baked in.
const DEV_URL = `http://${process.env.CAP_DEV_HOST || "localhost"}:8080`;

const config: CapacitorConfig = {
  appId: "app.pairup.streaks",
  appName: "PairUp",
  webDir: ".output/public",
  server: {
    url: PROD_URL || DEV_URL,
    cleartext: !PROD_URL,
  },
};

export default config;
