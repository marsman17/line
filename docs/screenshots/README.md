# Verified feature screens

These screenshots come from the browser workflows in `tests/browser/requested-features.spec.ts` using fictional restaurant guests.

- `colors-desktop.png` / `colors-mobile.png`: presets, native color picker and hex field in the workspace dialog.
- `customers-desktop.png` / `customers-mobile.png`: reference-style directory with the saved custom color and full Urdu translation.
- `analytics-desktop.png` / `analytics-mobile.png`: translated metrics and charts, all 24 hourly buckets and the saved custom color.

Run with Node.js 24 after installing the documented browser prerequisites: `npm run build` then `npm run test:e2e -- tests/browser/requested-features.spec.ts`. Screenshots are written to `/tmp/tableq-verified-*.png` in the cloud test environment.
