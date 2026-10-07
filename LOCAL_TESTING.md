# Test TableQ in VS Code

This is the complete app with local SQLite storage. No Docker, database server, paid service, or production account is needed.

## Start

1. Install **Node.js 24** and VS Code.
2. Download the ZIP from GitHub using **Code → Download ZIP**, extract it, and open the extracted **line-main** folder in VS Code (the folder containing `package.json`).
3. Open **Terminal → New Terminal** and run:

```sh
npm ci
npm run local
```

These commands work in Windows PowerShell, macOS, and Linux. The local launcher creates `.env.local` and notification keys on first use, then starts both the app and notification worker. Existing configuration and data are preserved.

Open `http://localhost:3000` in your browser. If port 3000 is already in use, run `npm run local -- --port 3005` instead and open `http://localhost:3005`. The launcher keeps the app, guest links, and QR URL on the chosen port.

**Manager login**

- Email: `admin@tableq.local`
- Password: `tableq-dev-only`

**Guest entrance:** `http://localhost:3000/check-in`

You can also press **F5** and select **TableQ: run and debug locally** after installing dependencies. VS Code's **Terminal → Run Task** menu includes install, run, unit test, and production build tasks.

## Try the full workflow

1. Sign in as the manager in one browser tab.
2. Open `/check-in` in another tab or browser window. Enter a guest name, party size, and email or an international phone number. Phone check-ins need the visit-update consent checkbox. Test details are fine: no SMS is sent without real Twilio configuration.
3. Submit. Keep the private guest status page open. Click **Notify me when it’s ready** and grant browser notification permission to test Web Push.
4. In the manager tab, click **Call guest**. The guest page changes to **Your table is ready** within five seconds. With push enabled, a browser notification is also attempted through your browser’s push service.
5. Select **Table ready**, click **Seat guest**, then select **Seated** and click **Free table**.
6. Try editing guest details, priority, cancellations, customer history, analytics, CSV export, and the check-in QR.

Use the browser’s responsive/device toolbar to test the mobile layout. QR codes generated in local mode point to localhost, so scanning them on a different phone will not reach your computer. To test an actual phone and off-page mobile alerts, use an HTTPS deployment as described in README.md. Windows/macOS notification settings, browser permissions, and outbound access to your browser’s push service can affect delivery. Live page updates work without push permission.

## Stop and restart

Press **Ctrl+C** in the terminal to stop the app and worker. Run `npm run local` to resume. Your visits are kept in `data/tableq.sqlite`.

To start with a clean queue, stop the app and worker, then remove the local `data` folder. This permanently deletes local visits and login sessions. The development account is recreated on the next startup. Avoid doing this to production data.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

Run the app once before type checking so Next.js can generate its route types. This local package uses the same application code and deployment files as the production version. Use `npm run local` for testing; `npm start` is production mode and requires production credentials.
