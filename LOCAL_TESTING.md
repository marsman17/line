# Test TableQ in VS Code

This is the complete app with local SQLite storage. No Docker, database server, paid service, or production account is needed.

## Start

1. Install **Node.js 24** and VS Code.
2. Download the ZIP from GitHub using **Code → Download ZIP**, extract it, and open the extracted **line-main** folder in VS Code (the folder containing `package.json`).
3. Open **Terminal → New Terminal** and run:

```sh
npm.cmd ci
npm.cmd run local
```

On Windows PowerShell, use `npm.cmd` as shown to avoid script execution-policy errors. On macOS/Linux, use `npm` instead of `npm.cmd`. The local launcher creates `.env.local` and notification keys on first use, then starts both the app and notification worker. Existing configuration and data are preserved.

Open `http://localhost:3000` in your browser. If port 3000 is already in use, run `npm.cmd run local -- --port 3005` instead and open `http://localhost:3005`. The launcher keeps the app, guest links, and QR URL on the chosen port.

**Public website:** `/website` (also shown at `/` when signed out).

**Pricing:** `/pricing`.

**Manager workspace:** click **Open TableQ**, or open `/app`.

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

## Customer directory

Open **Customers** to use the reference-style list, date presets/calendar, branch filter, search, priority and marketing-consent filters, and sorting. Click **Edit** to save profile details, private notes and explicit marketing consent. Activity and visit/no-show counts reflect the selected date range. Queue-update consent never automatically enables marketing consent. Export CSV respects all active customer filters.

For a called guest, the activity dialog includes **Mark no-show**. This ends their visit and frees reserved seats. Ordinary cancellations remain separate. Reservations and next-visit sorting are not yet supported.

## CMS accounts and branches

Open `http://localhost:3000/cms` (use your chosen port if different), or select **CMS administration** in the sidebar. The local administrator login above is also your CMS login. Production uses the administrator credentials you configured.

1. Open **Branches** and create a branch with its address and seating capacity.
2. Open **Manager accounts**, select **Add manager account**, enter a name/email and an initial password of at least 12 characters, and choose **Branch manager**. Select the branches that person may manage, then create the account.
3. Test their email/password in a private browser window. They can operate assigned queues, but cannot access the CMS or other branches.
4. To create another owner/CMS account, select **CMS administrator** as the role. It grants administration access and access to every branch.
5. Use **Edit** to reset a password or change access. Existing sessions are revoked. **Remove** deletes that account and revokes access while keeping restaurant/customer data. Your own CMS account is protected from these controls; edit personal details through **Profile**.

## Add branches

Sign in with the administrator account and click **Manage branches & staff** in the sidebar. Add branch details, then close the dialog and select the branch using **Branch**. Use **Check-in QR** to get that branch's entrance QR and public link. Queues, seats, guest history and individual analytics are separate. In **Analytics**, select **All branches** to see combined results.

In the same administration dialog, open **Staff access** to create accounts assigned to specific branches. Staff use the same login page and cannot access unassigned branches or administration.

## Update an existing installation

Stop the old app and worker with **Ctrl+C** before updating. Extract the new project ZIP into a new folder. Copy your old **data** folder and **.env.local** file into the new project folder before starting it. Run `npm.cmd ci` and `npm.cmd run local` there. Your original visits are automatically retained under the original branch. Keep the old folder as a backup until the new version works. Do not delete the old data to update.

## Stop and restart

Press **Ctrl+C** in the terminal to stop the app and worker. Run `npm.cmd run local` to resume. Your visits are kept in `data/tableq.sqlite`.

To start with a clean queue, stop the app and worker, then remove the local `data` folder. This permanently deletes local visits and login sessions. The development account is recreated on the next startup. Avoid doing this to production data.

## Checks

```sh
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Run the app once before type checking so Next.js can generate its route types. This local package uses the same application code and deployment files as the production version. Use `npm.cmd run local` for testing; `npm start` is production mode and requires production credentials.

## Restaurant website and menu links

In **CMS → Branches**, edit a branch and enter optional **Website URL** and **Menu URL** values, including `https://`. These links appear on that branch’s guest check-in and waiting pages and open in a new tab. Leave a field blank to hide its link. Branch managers retain queue access; administrators manage branch configuration. Existing data and links are preserved when updating other branch settings.

## Customize workspace colors

Click **Customize colors** above the account button in the sidebar, or **Account menu → Website color**. Select a preset, use the color picker, or enter a custom 3-/6-digit hex value; click **Save color**. Overview, Queue, Customers and Analytics update together, including chart marks, and the preference survives reloads. The same controls remain on the Profile page.
