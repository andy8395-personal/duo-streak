import type { CapacitorConfig } from "@capacitor/cli";

// This app is server-rendered (TanStack Start + Nitro), so the native shell
// loads the hosted production URL rather than bundling a static build.
// During local development it points at the local dev server instead —
// swap PROD_URL in before archiving a release build.
const PROD_URL = process.env.CAPACITOR_PROD_URL; // set once the app is deployed, see AGENTS.md
const DEV_URL = "http://localhost:8080";

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
