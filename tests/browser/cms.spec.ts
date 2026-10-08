import { test, expect } from "@playwright/test";
test.afterEach(async ({ page }) => {
  const response = await page.request.get("/api/cms");
  if (response.ok()) {
    const data = await response.json();
    const created = data.managers.find(
      (m: any) => m.email === "riverside-host@example.test",
    );
    if (created)
      await page.request.delete(`/api/cms/managers/${created.id}`, {
        headers: { Origin: "http://localhost:3100" },
      });
  }
});
test("CMS sign-in, branch setup, manager creation, roles, password resets and access revocation", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const origin = { Origin: "http://localhost:3100" };
  await page.goto("/cms");
  await expect(page).toHaveURL(/\/cms\/login/);
  await expect(
    page.getByRole("heading", { name: "CMS sign in" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace, managed." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Branches", exact: true }).click();
  await page.getByLabel("Branch name", { exact: true }).fill("CMS Riverside");
  await page
    .getByLabel("Branch address", { exact: true })
    .fill("25 Riverside Road");
  await page.getByLabel("Seating capacity", { exact: true }).fill("80");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByText("CMS Riverside", { exact: true })).toBeVisible();
  const state = await (await page.request.get("/api/cms")).json();
  const branch = state.branches.find((b: any) => b.name === "CMS Riverside");
  expect(branch.capacity).toBe(80);
  await page
    .getByRole("button", { name: "Manager accounts", exact: true })
    .click();
  await page.getByRole("button", { name: "Add manager account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Manager name", { exact: true })
    .fill("Riverside Host");
  await dialog
    .getByLabel("Manager email", { exact: true })
    .fill("riverside-host@example.test");
  await dialog.getByLabel("Initial password").fill("riverside-password-123");
  await dialog.getByLabel("CMS Riverside", { exact: true }).check();
  await dialog
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("riverside-host@example.test", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/tableq-cms-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/tmp/tableq-cms-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const context = await browser.newContext();
  const staff = await context.newPage();
  staff.on("pageerror", (e) => errors.push(e.message));
  await staff.goto("/cms/login");
  await staff.getByLabel("Email address").fill("riverside-host@example.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("riverside-password-123");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  expect((await staff.request.get("/api/cms")).status()).toBe(403);
  expect(
    (
      await staff.request.post("/api/cms/managers", {
        headers: origin,
        data: {
          name: "Attack",
          email: "attack@example.test",
          password: "test-password-12345",
          role: "admin",
          branchIds: [],
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await staff.request.post("/api/branches", {
        headers: origin,
        data: { name: "Attack", address: "Street", capacity: 50 },
      })
    ).status(),
  ).toBe(403);
  const tickets = await (await staff.request.get("/api/tickets")).json();
  expect(tickets.branchId).toBe(branch.id);
  expect(tickets.branches).toHaveLength(1);
  const account = (
    await (await page.request.get("/api/cms")).json()
  ).managers.find((m: any) => m.email === "riverside-host@example.test");
  await page
    .getByRole("button", {
      name: "Edit riverside-host@example.test",
      exact: true,
    })
    .click();
  await dialog
    .getByLabel("New password (leave blank to keep current)", { exact: true })
    .fill("updated-riverside-password-123");
  await dialog
    .getByRole("button", { name: "Save account", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await staff.request.get("/api/session")).status()).toBe(401);
  await staff.goto("/login");
  await staff.getByLabel("Email address").fill("riverside-host@example.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("riverside-password-123");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    staff.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toBeVisible();
  await staff
    .getByLabel("Password", { exact: true })
    .fill("updated-riverside-password-123");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "A warm welcome starts here." }),
  ).toBeVisible();
  await expect(
    staff.getByRole("link", { name: "CMS administration" }),
  ).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Edit riverside-host@example.test",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("combobox", { name: "Account role", exact: true })
    .selectOption("admin");
  await dialog
    .getByRole("button", { name: "Save account", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await staff.goto("/cms/login");
  await staff.getByLabel("Email address").fill("riverside-host@example.test");
  await staff
    .getByLabel("Password", { exact: true })
    .fill("updated-riverside-password-123");
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "Your workspace, managed." }),
  ).toBeVisible();
  const promoted = await (await staff.request.get("/api/cms")).json();
  expect(promoted.user.role).toBe("admin");
  const self = state.user;
  expect(
    (
      await page.request.delete(`/api/cms/managers/${self.id}`, {
        headers: origin,
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.patch(`/api/cms/managers/${self.id}`, {
        headers: origin,
        data: {
          name: "Owner",
          email: self.email,
          role: "staff",
          branchIds: [branch.id],
        },
      })
    ).status(),
  ).toBe(409);
  await page
    .getByRole("button", {
      name: "Remove riverside-host@example.test",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Remove account", exact: true })
    .click();
  await expect(
    page.getByText("riverside-host@example.test", { exact: true }),
  ).not.toBeVisible();
  expect((await staff.request.get("/api/cms")).status()).toBe(401);
  expect((await page.request.get("/api/cms")).status()).toBe(200);
  expect(
    (await page.request.get("/api/public?branch=" + branch.id)).status(),
  ).toBe(200);
  expect(account.role).toBe("staff");
  await context.close();
  expect(errors).toEqual([]);
});
