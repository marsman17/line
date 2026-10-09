# TableQ Customers, Analytics and color controls — October 9, 2026

This package includes:

- **Optional estimates:** CMS → Branches → Edit branch → Use service-based wait estimates. Disabled by default. Configure average duration and seating capacity; managers still free seats manually.
- **TableQ design:** light and botanical green defaults for new accounts and public guest pages; the marketing website uses its own cream/green design. Dark and System themes remain available.
- **Stable theme options:** Account menu → Theme. Labels stay on the left; the selected option gets a tick in a reserved column on the right.
- **Restaurant logos:** CMS → Branches → Upload company logo. PNG/JPG up to 2 MB. Logos appear beside the selected branch and on guest pages; each branch can have its own logo. Personal profile pictures are separate.
- **Customers:** reference-style date/branch/search/priority/consent controls, sorting, CSV export, editable profiles and activity. Changing the customer branch now also changes the workspace branch; dates, activity numbers, export headings and consent values use the selected language. The directory and date/editor sheets follow the theme and saved color.
- **Analytics:** real demand for all 24 hours, selected-range branch comparisons, explicit no-show/cancellation totals, and missing wait measurements shown as unavailable. Chart marks use the saved color; descriptions, dates and numbers use the selected language.
- **Color selector:** click **Customize colors** above the account button in the workspace sidebar, or **Account menu → Website color**. Choose a preset, use the color picker, or enter a 3- or 6-digit hex value, then **Save color**. This immediately updates Overview, Queue, Customers and Analytics and persists across reloads. Controls are also available under Profile → Website color. The dialog remains visible on mobile independently of the collapsed sidebar.
- **Workspace translations:** Account menu → Language. Overview, Queue, Customers, Analytics, account settings and branch controls translate, including Urdu with right-to-left layout. Customer-entered names remain unchanged. The public marketing website currently remains English.
- **Website/menu links:** CMS → Branches → Edit branch. Optional links appear on guest check-in and waiting pages.

## Verified screen examples

Open `docs/screenshots/` for desktop/mobile examples of the preset/hex dialog, Customers and Analytics. Screens use fictional test guests; Urdu examples demonstrate that translation extends beyond the sidebar.

## Run this copy

Install Node.js 24. Extract into a **new folder**, open the folder containing `package.json` in VS Code, then run `npm.cmd ci` and `npm.cmd run local` on Windows (`npm` on macOS/Linux). Open http://localhost:3000. Stop any older TableQ app first so it does not keep serving on port 3000. For another port: `npm.cmd run local -- --port 3005`.

Local test login: `admin@tableq.local` / `tableq-dev-only`. Never deploy those credentials.

## Keep existing data

Stop the old app and worker, back up the old folder, and copy its `data` folder and `.env.local` into this new folder before running. Existing account language, accent and theme preferences are preserved. You do not need to recreate customers or branches to access these controls. To adopt the new appearance on an existing account, choose **Light** under Theme and the **TableQ** color preset in Website color (Profile). Do not delete restaurant data to change appearance.

Multi-company isolation, public signup/recovery and subscription billing remain unfinished; this release does not claim global SaaS launch readiness.
