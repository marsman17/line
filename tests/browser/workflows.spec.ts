import { test, expect } from "@playwright/test";
test("mobile guest check-in, manager CRUD, notifications, and seating", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/check-in");
  await expect(
    page.getByRole("heading", { name: "A table is worth the wait." }),
  ).toBeVisible();
  await page.getByPlaceholder("What should we call you?").fill("Alex Morgan");
  await page.getByPlaceholder("+15551234567").fill("+15551234567");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Join the queue", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guest\//);
  const guestURL = page.url();
  expect(
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      return Boolean(
        registration.active || registration.installing || registration.waiting,
      );
    }),
  ).toBe(true);
  await expect(
    page.getByRole("heading", { name: "You’re on the list, Alex." }),
  ).toBeVisible();
  await expect(page.getByText("in the queue", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const manager = await context.newPage();
  manager.on("pageerror", (e) => errors.push(e.message));
  await manager.goto("/app");
  await expect(manager).toHaveURL(/\/login/);
  await manager.getByLabel("Email address").fill("manager@example.test");
  await manager
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await manager.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    manager.getByRole("heading", { name: "A warm welcome starts here." }),
  ).toBeVisible();
  await expect(manager.getByText("Alex Morgan", { exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "Edit Alex Morgan" }).click();
  await manager.getByLabel("Notes").fill("Window table, please");
  await manager.getByRole("button", { name: "Save changes" }).click();
  await expect(
    manager.getByText("Window table, please", { exact: true }),
  ).toBeVisible();
  await manager
    .getByRole("button", { name: "Call guest", exact: true })
    .click();
  await expect(
    manager.getByRole("button", { name: "Table ready 1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your table is ready." }),
  ).toBeVisible({ timeout: 15000 });
  await manager.getByRole("button", { name: "Table ready 1" }).click();
  await manager
    .getByRole("button", { name: "Seat guest", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Enjoy your meal." }),
  ).toBeVisible({ timeout: 15000 });
  await manager.getByRole("button", { name: "Seated 1" }).click();
  await manager
    .getByRole("button", { name: "Free table", exact: true })
    .click();
  await expect(manager.getByText("Completed", { exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "Get your QR code" }).click();
  const qr = manager.getByRole("img", {
    name: "Scan to join the restaurant queue",
  });
  await expect(qr).toBeVisible();
  expect(
    await qr.evaluate((img: HTMLImageElement) => img.naturalWidth > 0),
  ).toBe(true);
  await manager.getByRole("button", { name: "Close dialog" }).click();
  await manager.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(manager.getByText("Alex Morgan", { exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(
    manager.getByRole("heading", { name: "Understand every wait." }),
  ).toBeVisible();
  await expect(manager.getByRole("img").first()).toBeVisible();
  await manager.setViewportSize({ width: 390, height: 844 });
  await manager.getByRole("button", { name: "Open navigation" }).click();
  await manager
    .getByRole("button", { name: "Queue", exact: false })
    .first()
    .click();
  await expect(
    manager.getByRole("heading", { name: "Your queue." }),
  ).toBeVisible();
  expect(
    await manager.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await manager.getByRole("button", { name: "Add guest", exact: true }).click();
  await manager.getByLabel("Guest name").fill("Jordan Lee");
  await manager
    .getByRole("button", { name: "Add to queue", exact: true })
    .click();
  await expect(manager.getByText("Jordan Lee", { exact: true })).toBeVisible();
  await manager.getByRole("button", { name: "Cancel Jordan Lee" }).click();
  await manager.getByRole("button", { name: "Confirm", exact: true }).click();
  await manager.getByRole("button", { name: "Cancelled 1" }).click();
  await manager.getByRole("button", { name: "Delete Jordan Lee" }).click();
  await manager.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(manager.getByText("Jordan Lee", { exact: true })).toHaveCount(0);
  await manager.setViewportSize({ width: 1440, height: 1000 });
  await manager.getByRole("button", { name: "Overview", exact: true }).click();
  await manager.getByRole("button", { name: "Waiting 0" }).click();
  await manager.screenshot({
    path: "test-results/desktop-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await manager.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () =>
      manager
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await manager.screenshot({
    path: "test-results/mobile-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: "test-results/mobile-guest.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await context.close();
  expect(guestURL).toContain("/guest/");
});
test("API authorization, privacy, validation, origin protection, cancellation, and export", async ({
  request,
  page,
}) => {
  expect((await request.get("/api/tickets")).status()).toBe(401);
  expect((await request.get("/api/qr")).status()).toBe(401);
  expect(
    (
      await request.post("/api/join", {
        headers: { Origin: "https://malicious.example" },
        data: {
          name: "Other",
          phone: "+15555555555",
          email: "",
          partySize: 2,
          consent: true,
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/join", {
        headers: { Origin: "http://localhost:3100" },
        data: { name: "", phone: "bad", email: "", partySize: 0 },
      })
    ).status(),
  ).toBe(400);
  const joined = await request.post("/api/join", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Taylor Park",
      phone: "",
      email: "taylor@example.test",
      partySize: 3,
      consent: false,
      priority: true,
      notes: "private",
    },
  });
  expect(joined.status()).toBe(201);
  const ticket = await joined.json();
  const state = await (await request.get(`/api/guest/${ticket.token}`)).json();
  expect(state).not.toHaveProperty("phone");
  expect(state).not.toHaveProperty("email");
  expect(state).not.toHaveProperty("notes");
  expect(state).not.toHaveProperty("token_hash");
  expect((await request.get("/api/guest/not-a-valid-token")).status()).toBe(
    404,
  );
  await page.goto(`/guest/${ticket.token}`);
  await page
    .getByRole("button", { name: "Need to leave? Cancel this visit" })
    .click();
  await page.getByRole("button", { name: "Leave queue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "You’ve left the queue." }),
  ).toBeVisible();
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe("tableq-customers.csv");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("branch administration, separate guest queues, staff permissions and combined analytics", async ({
  browser,
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  expect(
    (
      await page.request.post("/api/tickets?branch=main", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Main branch isolation guest",
          phone: "",
          email: "",
          partySize: 2,
        },
      })
    ).status(),
  ).toBe(201);
  await page.getByLabel("Branch name", { exact: true }).fill("North Garden");
  await page.getByLabel("Branch address").fill("10 North Street");
  await page.getByLabel("Seating capacity").fill("4");
  await page.getByLabel("Opening hours").fill("Mon–Sun 12:00–22:00");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Branch added.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("combobox", { name: "Branch", exact: true })
    .selectOption({ label: "North Garden" });
  const branchId = await page
    .getByRole("combobox", { name: "Branch", exact: true })
    .inputValue();
  await expect(page.getByText("Alex Morgan", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Check-in QR", exact: true }).click();
  const link = page.getByRole("link", { name: "Open check-in", exact: false });
  await expect(link).toHaveAttribute("href", "/check-in?branch=" + branchId);
  const qr = page.getByRole("img", {
    name: "Scan to join the restaurant queue",
  });
  await expect(qr).toBeVisible();
  await expect
    .poll(() => qr.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const guest = await guestContext.newPage();
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.goto("/check-in?branch=" + branchId);
  await expect(
    guest.getByRole("heading", { name: "North Garden" }),
  ).toBeVisible();
  await expect(
    guest.getByText("Opening hours: Mon–Sun 12:00–22:00"),
  ).toBeVisible();
  await guest
    .getByPlaceholder("What should we call you?")
    .fill("North Visitor");
  await guest.getByRole("button", { name: "Increase party size" }).click();
  await guest.getByRole("button", { name: "Increase party size" }).click();
  await guest.getByPlaceholder("you@example.com").fill("north@example.test");
  await guest
    .getByRole("button", { name: "Join the queue", exact: true })
    .click();
  await expect(guest).toHaveURL(/\/guest\//);
  const secret = guest.url().split("/").pop()!;
  const privateGuest = await (
    await guest.request.get("/api/guest/" + secret)
  ).json();
  expect(privateGuest.branchId).toBe(branchId);
  expect(privateGuest.position).toBe(1);
  await expect(page.getByText("North Visitor", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const origin = { Origin: "http://localhost:3100" };
  const adminData = await (
    await page.request.get("/api/tickets?branch=" + branchId)
  ).json();
  const ticket = adminData.tickets.find(
    (t: { name: string }) => t.name === "North Visitor",
  );
  const mainData = await (
    await page.request.get("/api/tickets?branch=main")
  ).json();
  expect(mainData.tickets.some((t: { id: string }) => t.id === ticket.id)).toBe(
    false,
  );
  expect(
    (
      await page.request.patch(`/api/tickets/${ticket.id}?branch=main`, {
        headers: origin,
        data: { status: "notified" },
      })
    ).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page.getByRole("button", { name: "Staff access", exact: true }).click();
  await page.getByLabel("Staff email").fill("north-manager@example.test");
  await page.getByLabel("Initial password").fill("north-password-12345");
  await page
    .getByRole("checkbox", { name: "North Garden", exact: true })
    .check();
  await page.getByRole("button", { name: "Create staff account" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Staff account created.",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  const staffContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const staff = await staffContext.newPage();
  staff.on("pageerror", (e) => errors.push(e.message));
  await staff.goto("/login");
  await staff.getByLabel("Email address").fill("north-manager@example.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("north-password-12345");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(staff.getByText("North Visitor", { exact: true })).toBeVisible();
  await staff.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    staff.getByRole("combobox", { name: "Branch", exact: true }),
  ).toHaveValue(branchId);
  await expect(
    staff.getByRole("button", { name: "Manage branches & staff" }),
  ).toHaveCount(0);
  await staff
    .getByRole("button", { name: "Queue", exact: false })
    .first()
    .click();
  expect((await staff.request.get("/api/tickets?branch=main")).status()).toBe(
    403,
  );
  expect((await staff.request.get("/api/qr?branch=main")).status()).toBe(403);
  expect(
    (
      await staff.request.post("/api/branches", {
        headers: origin,
        data: { name: "Unauthorized", address: "Elsewhere", capacity: 10 },
      })
    ).status(),
  ).toBe(403);
  const all = await (await staff.request.get("/api/tickets?branch=all")).json();
  expect(all.branches).toHaveLength(1);
  expect(
    all.tickets.every((t: { branch_id: string }) => t.branch_id === branchId),
  ).toBe(true);
  expect(
    (
      await staff.request.delete(
        `/api/tickets/${mainData.tickets[0].id}?branch=main`,
        { headers: origin },
      )
    ).status(),
  ).toBe(403);
  await staff.getByRole("button", { name: "Call guest", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "Your table is ready." }),
  ).toBeVisible({ timeout: 15000 });
  await staff
    .getByRole("button", { name: "Table ready 1", exact: true })
    .click();
  await expect(
    staff.getByRole("button", { name: "Seat guest", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Branch", exact: true })
    .selectOption("all");
  await expect(
    page.getByRole("heading", { name: "Branch comparison" }),
  ).toBeVisible();
  await expect(
    page.getByText("North Garden", { exact: true }).last(),
  ).toBeVisible();
  expect((await page.request.get("/api/qr?branch=all")).status()).toBe(400);
  await page
    .getByRole("combobox", { name: "Branch", exact: true })
    .selectOption(branchId);
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await page
    .locator(".branch-item")
    .filter({ has: page.getByText("North Garden", { exact: true }) })
    .getByRole("button", { name: "Edit branch" })
    .click();
  await page.getByRole("checkbox", { name: "Archived", exact: false }).check();
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "before archiving",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(
    (
      await page.request.patch(`/api/tickets/${ticket.id}?branch=${branchId}`, {
        headers: origin,
        data: { status: "cancelled" },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page
    .locator(".branch-item")
    .filter({ has: page.getByText("North Garden", { exact: true }) })
    .getByRole("button", { name: "Edit branch" })
    .click();
  await page.getByRole("checkbox", { name: "Archived", exact: false }).check();
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Branch updated.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await guest.goto("/check-in?branch=" + branchId);
  await expect(
    guest.getByText("This branch is closed for check-in."),
  ).toBeVisible();
  await expect(
    guest.getByRole("button", { name: "Join the queue", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await guest.request.post("/api/join?branch=" + branchId, {
        headers: origin,
        data: {
          name: "Closed",
          phone: "",
          email: "closed@example.test",
          partySize: 2,
        },
      })
    ).status(),
  ).toBe(409);
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page.getByRole("button", { name: "Staff access", exact: true }).click();
  await page.getByRole("button", { name: "Edit staff", exact: true }).click();
  await page
    .getByLabel("New password", { exact: false })
    .fill("rotated-password-12345");
  await page.getByRole("button", { name: "Save staff", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Staff access updated.");
  expect((await staff.request.get("/api/tickets")).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await guestContext.close();
  await staffContext.close();
});

test("customer reference layout, filters, profile editing, activity and filtered CSV", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A warm welcome starts here." }),
  ).toBeVisible();
  const headers = { Origin: "http://localhost:3100" };
  const b = await page.request.post("/api/branches", {
    headers,
    data: {
      name: "Customer Reference",
      address: "22 Customer Street",
      capacity: 30,
    },
  });
  expect(b.status()).toBe(201);
  const branch = await b.json();
  async function add(name: string, email: string, priority = false) {
    const r = await page.request.post("/api/tickets?branch=" + branch.id, {
      headers,
      data: { name, email, phone: "", partySize: 2, priority, consent: true },
    });
    expect(r.status()).toBe(201);
    return r.json();
  }
  const first = await add(
    "Hooriya Hussain",
    "hooriyahussain20@gmail.com",
    true,
  );
  await add("Hooriya Hussain", "hooriyahussain20@gmail.com");
  await add("Aurangzeb Ahmed", "aurangzebwork2020@gmail.com");
  await add("Sarmad", "sarmad321@gmail.com");
  const called = await add("Irshad", "irshadaltaf40@gmail.com");
  expect(
    (
      await page.request.patch(`/api/tickets/${first.id}?branch=${branch.id}`, {
        headers,
        data: { status: "notified" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(`/api/tickets/${first.id}?branch=${branch.id}`, {
        headers,
        data: { status: "served" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.patch(
        `/api/tickets/${called.id}?branch=${branch.id}`,
        { headers, data: { status: "notified" } },
      )
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Customers", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Customer branch", exact: true })
    .selectOption(branch.id);
  const rows = page.locator(".customer-list-row");
  await expect(rows).toHaveCount(4);
  await expect(
    page.getByText("4 customers match", { exact: true }),
  ).toBeVisible();
  await expect(rows.getByText("Not granted", { exact: true })).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Priority filter" })
    .selectOption("yes");
  await expect(rows).toHaveCount(1);
  await expect(
    rows.getByText("Hooriya Hussain", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Priority filter" })
    .selectOption("no");
  await expect(rows).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Priority filter" })
    .selectOption("any");
  await expect(rows).toHaveCount(4);
  await page
    .getByRole("combobox", { name: "Sort customers" })
    .selectOption("name");
  await expect(
    rows.first().getByText("Aurangzeb Ahmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sort descending" }).click();
  await expect(rows.first().getByText("Sarmad", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit customer Hooriya Hussain", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Customer Hooriya Hussain" }),
  ).toBeVisible();
  await expect(dialog.getByText("Showed", { exact: true })).toBeVisible();
  await expect(dialog.locator(".customer-activity-row")).toHaveCount(2);
  await dialog
    .getByLabel("Name (optional)", { exact: true })
    .fill("Hooriya Updated");
  await dialog
    .getByLabel("Phone (optional)", { exact: true })
    .fill("+15551234567");
  await dialog
    .getByLabel("Email (optional)", { exact: true })
    .fill("hooriya.updated@example.test");
  await dialog
    .getByRole("switch", { name: "Marketing consent", exact: true })
    .check();
  await dialog
    .getByPlaceholder("Internal customer notes")
    .fill("Prefers a quiet table.");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Marketing consent filter" })
    .selectOption("granted");
  await expect(rows).toHaveCount(1);
  await expect(
    rows.getByText("Hooriya Updated", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tableq-customers.csv");
  const stream = await download.createReadStream();
  let content = "";
  for await (const chunk of stream!) content += chunk.toString();
  expect(content).toContain("Hooriya Updated");
  expect(content).toContain("Granted");
  expect(content).not.toContain("Aurangzeb Ahmed");
  await page.reload();
  await page.getByRole("button", { name: "Customers", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Customer branch", exact: true })
    .selectOption(branch.id);
  await expect(rows).toHaveCount(4);
  await page
    .getByRole("button", { name: "Edit customer Hooriya Updated", exact: true })
    .click();
  await expect(dialog.getByPlaceholder("Internal customer notes")).toHaveValue(
    "Prefers a quiet table.",
  );
  await expect(
    dialog.getByRole("switch", { name: "Marketing consent", exact: true }),
  ).toBeChecked();
  await dialog
    .getByLabel("Name (optional)", { exact: true })
    .fill("Discarded name");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    rows.getByText("Hooriya Updated", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit customer Irshad", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await dialog
    .getByRole("button", { name: "Mark no-show", exact: true })
    .click();
  await expect(dialog.getByText("No-show", { exact: true })).toBeVisible();
  await expect(dialog.locator(".customer-activity-summary")).toContainText(
    "No-show: 1",
  );
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Last 365 days", exact: false })
    .click();
  await dialog.getByRole("button", { name: "Yesterday", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(rows).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No customers match." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yesterday", exact: false }).click();
  await dialog.getByLabel("Start date", { exact: true }).fill("2020-01-01");
  await dialog.getByLabel("End date", { exact: true }).fill("2099-12-31");
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(rows).toHaveCount(4);
  await page
    .getByRole("textbox", { name: "Search customers", exact: true })
    .fill("15551234567");
  await expect(rows).toHaveCount(1);
  await expect(
    rows.getByText("Hooriya Updated", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search customers", exact: true })
    .fill("");
  await expect(rows).toHaveCount(4);
  await page
    .getByRole("button", { name: "Jan 1, 2020 – Dec 31, 2099", exact: false })
    .click();
  await dialog
    .getByRole("button", { name: "Last 365 days", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sort customers" })
    .selectOption("last");
  await page.screenshot({
    path: "test-results/customer-reference-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit customer Hooriya Updated", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/customer-reference-editor.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/customer-reference-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit customer Hooriya Updated", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Save changes", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  const list = await (
    await page.request.get("/api/customers?branch=" + branch.id)
  ).json();
  const customer = list.customers.find(
    (c: { name: string }) => c.name === "Hooriya Updated",
  );
  expect(customer.history).toHaveLength(2);
  expect(customer.history[0].consent).toBe(1);
  expect(
    (
      await page.request.post("/api/staff", {
        headers,
        data: {
          email: "customer-guardstaff@example.test",
          password: "customer-password-12345",
          branchIds: ["main"],
        },
      })
    ).status(),
  ).toBe(201);
  const staffContext = await browser.newContext();
  const staff = await staffContext.newPage();
  await staff.goto("/login");
  await staff
    .getByLabel("Email address")
    .fill("customer-guardstaff@example.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("customer-password-12345");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "A warm welcome starts here." }),
  ).toBeVisible();
  expect(
    (await staff.request.get("/api/customers?branch=" + branch.id)).status(),
  ).toBe(403);
  expect(
    (
      await staff.request.patch(
        `/api/customers/${customer.id}?branch=${branch.id}`,
        {
          headers,
          data: {
            name: "Forbidden",
            phone: "",
            email: "",
            notes: "",
            marketingConsent: true,
          },
        },
      )
    ).status(),
  ).toBe(403);
  await staffContext.close();
  expect(errors).toEqual([]);
});
