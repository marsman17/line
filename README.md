# TableQ

A restaurant queue manager with a dark manager workspace and a light guest check-in experience, inspired by the supplied mobile reference. The responsive desktop interface uses the same workflows.

## What works

- Guests scan an entrance QR, enter their name, party size, and phone or email, and receive a private live status page.
- Manager sign-in with hashed passwords, expiring HTTP-only sessions, request-origin protection, and login/check-in rate limits.
- Add, edit, prioritize, call, seat, cancel, return to waiting, and permanently delete visits. Release seated tables as guests leave. Capacity checks include both called and seated parties.
- QR generation and SVG downloads using your configured public URL.
- Web Push notifications, including a service worker, notification click handling, and iPhone Home Screen guidance. Optional Twilio SMS with explicit guest consent.
- Durable SQLite notification outbox, delivery leases, bounded retries, and an independent notification worker.
- Searchable customer history, CSV exports protected against formula injection, date/status queue filters, and analytics calculated from actual visits.
- Loading, empty, validation, disconnected, and error states. No fake restaurant metrics or prepopulated customer records.

This release supports multiple branches, administrator accounts and staff assigned to specific branches. Billing/subscriptions, general account settings and self-service password recovery, reservations, email delivery, and exact replication of screens not supplied in the reference are outside this scope. Estimated waits use a simple five-minute-per-party heuristic and are clearly labeled estimates.

## Multiple branches and staff

Sign in as an administrator and select **Manage branches & staff** in the sidebar. Create or edit a branch with its name, address, seating capacity and displayed opening hours. The original restaurant and its existing visits are migrated automatically into the `main` branch; existing private guest links and sessions remain valid. Environment restaurant values seed the original branch once. After that, edit branch details in the app.

Use the **Branch** selector to switch queues. Each branch has its own capacity, customer history, queue order, check-in link (`/check-in?branch=ID`) and downloadable QR. Open **Analytics**, then select **All branches** for combined results and a branch comparison. CSV visit exports include the branch name.

Under **Staff access**, create staff accounts with passwords of at least 12 characters and assign one or more branches. Staff can manage visits and view analytics only for assigned branches; administrators manage all branches and staff. Share credentials privately. Updating staff access or a password revokes that account's sessions. Removing staff also revokes access. Existing manager accounts become administrators during migration.

Archive branches only after cancelling/finishing active visits and freeing occupied tables. Archived branches stop accepting check-ins but keep visit history and private guest links. Restore them by editing and clearing **Archived**. Opening hours are informational; this release does not automatically schedule check-in opening/closing or handle branch time zones. Notification messages name the guest's branch, while all branches share the configured Web Push/Twilio provider.

## Customers

The Customers page uses the supplied list and detail-dialog references. Filter by branch, name/phone/email, date presets or a custom calendar range, priority visits and marketing consent. Sort by customer, total visits, last visit, phone or email in either direction. CSV exports include every matching customer in the current filter, not only visible rows. Date boundaries use complete days in the browser's local time zone.

Customer profiles have stable IDs, optional name/phone/email, private notes and an explicit marketing-consent flag. Existing visits migrate automatically into branch-scoped profiles. Marketing consent is separate from visit-update consent and defaults to **Not granted**, including for existing guests who agreed to queue alerts. Editing a profile preserves visit history; historical visit details and queue alert consent are retained. Future check-ins matching the profile's current phone or email attach to that profile. Editing a profile does not send marketing messages.

Activity shows queue reference numbers, visit date/time, party size, priority and real status. Seated visits show **Showed**. A called guest can be explicitly marked **No-show** from their activity, cancelling the visit and releasing reserved seats. Ordinary cancellations are not counted as no-shows. Counts and priority filters reflect visits in the selected date range. **Next visit** sorting is disabled because reservations are not implemented.

Deleting a visit also deletes its profile if it was that customer's final visit. Profiles with remaining visits retain their history and notes. Staff can access and edit profiles only within their assigned branches.

## Local development

For a ready-to-run VS Code setup, follow [LOCAL_TESTING.md](LOCAL_TESTING.md): `npm ci` then `npm run local` starts the app and notification worker together.

Use Node.js **24** (SQLite is provided by `node:sqlite`).

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The development-only manager is `admin@tableq.local` with password `tableq-dev-only`. It is never created in production. Data is stored in ignored `data/tableq.sqlite`. `/check-in` is the public guest entrance. After a manager adds a guest, a banner offers their private status link for sharing. Both manager-created and self-check-in visits can enable push from that link.

For local browser push, generate a pair once:

```sh
npx web-push generate-vapid-keys
```

Store these values in ignored `.env.local` as `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a contact `mailto:` address). Use `APP_URL=http://localhost:3000` locally. Keep the private key confidential; keep the same pair across deployments. localhost is a secure browser context for testing, but phones accessing a LAN HTTP address cannot use push. Use a real HTTPS deployment for phone testing.

## Production deployment: Docker Compose + HTTPS

This app is designed for a single persistent Linux host with Docker Compose, not an ephemeral or horizontally scaled serverless filesystem. Keep the app and worker on the same SQLite volume. Do not run multiple app replicas or mount SQLite on a network filesystem.

1. Copy `.env.example` to `.env` and restrict its permissions (`chmod 600 .env`). Set `APP_DOMAIN`, `APP_URL` to its **HTTPS origin**, the restaurant name/address/capacity, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 12 characters. Do not use the development account.
2. Point your domain’s DNS to the host and allow inbound ports 80/443. Caddy obtains and renews TLS certificates automatically. The app’s port is private behind Caddy; Caddy replaces client-supplied forwarding headers before passing them to the app.
3. Configure at least one mobile alert channel before live service:
   - **Web Push:** set all three `VAPID_*` values. Generate keys once and preserve them; HTTPS and a guest’s notification permission are required. iOS guests must install the page on their Home Screen first. Ensure the server can reach the push services used by your guests, such as `fcm.googleapis.com`, `updates.push.services.mozilla.com`, and Apple’s `*.push.apple.com` endpoints.
   - **SMS:** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`. The sender must be SMS-enabled and able to send to guests’ countries. Trial accounts require verified recipients. Ensure HTTPS egress to `api.twilio.com`. SMS may incur provider charges.
4. Build and start:

```sh
docker compose up --build -d
```

`npm start` validates configuration before the app starts and creates the manager account on the first startup. Existing accounts are retained on subsequent restarts; changing `.env` alone does **not** rotate passwords. The worker starts after the app health check passes. Caddy terminates HTTPS and forwards requests to the app.

5. Verify `https://YOUR_DOMAIN/api/health` returns `{"status":"ok"}`. Sign in, download the QR, scan it with a real phone, join, enable alerts, then lock the phone and call that guest from the manager screen. Confirm the phone receives the alert, seat the guest, and free the table. Provider acceptance is tracked; actual device or carrier delivery is not guaranteed. Do this live smoke test before serving real guests.

Without push or SMS configured, the guest’s status page still updates while open, and the manager sees a configuration notice. This is not sufficient for off-page mobile alerts.

To rotate the manager password, update the secret in `.env` and run:

```sh
docker compose run --rm --entrypoint node_modules/.bin/tsx app scripts/setup.ts
```

This revokes all existing manager sessions. Restart services after changing other environment variables with `docker compose up -d --force-recreate`.

## Production without Docker

Use a persistent filesystem, Node 24, a reverse proxy providing HTTPS, and process supervision for **both** the app and worker. Load environment variables securely into each process. Next loads `.env.local` for the app; standalone scripts also load `.env.local` (or `.env` if no local file exists). Exported variables take precedence.

```sh
npm ci
npm run build
npm start
# In a separate supervised process, with the same environment and DATABASE_PATH:
NODE_ENV=production npm run worker
```

Set `TRUST_PROXY=true` only when your reverse proxy removes and replaces `X-Forwarded-For`, and prevent direct access to the app port. Otherwise leave it false; rate limits use a shared conservative bucket. A restart is safe for data; live processes must always be restarted.

## Backups and operations

Back up SQLite using its backup API or stop **both** app and worker before copying the full data volume. Copying only the `.sqlite` file while it is open can omit WAL transactions. Keep backups encrypted and access restricted because guest contact details are private. Configure a retention policy suitable for your restaurant; visit deletion permanently removes that visit and its push subscription/outbox records. There is no automatic retention job in this release.

A single VAPID key pair must persist independently of the database backup. Monitor app/worker logs and failed notification records. Retried provider requests are at-least-once: if a provider accepts a request and the process crashes before recording it, a duplicate alert is possible.

## Verification

```sh
npm run typecheck
npm test
npm run build
# Install Playwright Chromium if no browser is installed:
npx playwright install chromium
# CHROMIUM_PATH defaults to /usr/bin/chromium; set it to your browser executable or an empty string to use Playwright’s downloaded Chromium.
npm run test:e2e
```

The browser suite uses a separate database under `/tmp/tableq-e2e`, a production server on port 3100, and a test-only account. It covers mobile QR check-in, guest live updates, manager login and CRUD, seating/table release, QR rendering, CSV download, responsive layout, private API access, and origin checks. Unit tests exercise branch isolation, additive database migration, archive/restore rules, capacity, queue order, transitions, consent, rate limiting, password verification, and mocked SMS delivery/retry behavior. Browser checks also cover branch administration, branch-specific QR/check-in, staff authorization, session revocation and combined analytics. Actual SMS and device push require the production phone smoke test above.
