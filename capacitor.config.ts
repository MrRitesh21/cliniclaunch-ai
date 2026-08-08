import { CapacitorConfig } from "@capacitor/cli";

// Capacitor config — wraps the published ClinicX web app as native iOS / Android shells.
//
// Setup (run on your local machine, not in Lovable):
//   1. bun add -d @capacitor/cli && bun add @capacitor/core @capacitor/ios @capacitor/android
//   2. bun run build && npx cap init  (skip if this file already exists)
//   3. npx cap add ios && npx cap add android
//   4. npx cap sync
//   5. npx cap open ios   (requires Xcode)
//      npx cap open android (requires Android Studio)
//
// The `server.url` below makes the native shells load the live published site,
// so doctors get instant updates without re-submitting to the stores. Remove
// `server.url` and switch to `webDir: "dist"` for an offline-bundled build.
const config: CapacitorConfig = {
  appId: "app.clinicx.doctor",
  appName: "ClinicX",
  webDir: "dist",
  server: {
    url: "https://project--c1fda9ab-1334-408d-a8d8-a789b9e92728.lovable.app/auth",
    cleartext: false,
  },
  ios: { contentInset: "always" },
  android: { allowMixedContent: false },
};

export default config;
