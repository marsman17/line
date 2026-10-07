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
  await manager.goto("/");
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
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});
