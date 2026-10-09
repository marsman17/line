import { test, expect } from "@playwright/test";
import sharp from "sharp";
async function login(
  page: import("@playwright/test").Page,
  email = "manager@example.test",
  password = "test-password-12345",
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
}
test("profile, all account languages, theme persistence and administrator support inbox", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.locator("html").evaluate(el => el.style.getPropertyValue("--accent"))).toBe("#237b63");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: "/tmp/tableq-account-menu.png" });
  await page.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Olive Host");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Changes saved.");
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Olive Host",
  );
  await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  const png = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#458c62" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Upload picture")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("status")).toHaveText("Picture saved.");
  await expect(page.locator(".account-avatar.large img")).toBeVisible();
  expect(
    (await page.request.get("/api/account/avatar")).headers()["content-type"],
  ).toBe("image/jpeg");
  await page.getByLabel("Upload picture").setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "invalid",
  );
  await page.getByLabel("Phone number", { exact: true }).fill("5551234567");
  await expect(
    page.getByRole("button", { name: "Send verification code" }),
  ).toBeDisabled();
  await page.screenshot({
    path: "/tmp/tableq-profile-desktop.png",
    fullPage: true,
  });
  for (const [name, menu, profile] of [
    ["Español", "Menú de cuenta", "Perfil"],
    ["Português", "Menu da conta", "Perfil"],
    ["Deutsch", "Kontomenü", "Profil"],
    ["Français", "Menu du compte", "Profil"],
    ["Italiano", "Menu account", "Profilo"],
    ["English", "Account menu", "Profile"],
  ]) {
    await page.locator(".account-trigger").click();
    await page.locator(".account-popover>button").first().click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: profile, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: menu, exact: true }),
    ).toBeVisible();
    await page.locator(".account-trigger").click();
  }
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "/tmp/tableq-profile-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Contact support", exact: true })
    .click();
  await page.getByLabel("Feature Request", { exact: true }).check();
  await page
    .getByLabel("Comment", { exact: true })
    .fill("Please add a patio view.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Feedback saved for workspace administrators.",
  );
  await page
    .getByRole("button", { name: "Workspace feedback", exact: true })
    .click();
  await expect(
    page.getByText("Please add a patio view.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Mark resolved", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Resolved", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/tableq-profile-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Italiano", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Restore shared administrator defaults for the queue workflows.
  await page.request.patch("/api/account", {
    headers: { Origin: "http://localhost:3100" },
    data: { language: "en", theme: "system" },
  });
  expect(errors).toEqual([]);
});
test("staff feedback isolation, request-origin checks, and safe self-account deletion", async ({
  browser,
  page,
}) => {
  await login(page);
  const origin = { Origin: "http://localhost:3100" };
  expect(
    (
      await page.request.post("/api/staff", {
        headers: origin,
        data: {
          email: "self-delete@example.test",
          password: "staff-test-password-123",
          branchIds: ["main"],
        },
      })
    ).status(),
  ).toBe(201);
  const context = await browser.newContext();
  const staff = await context.newPage();
  await login(staff, "self-delete@example.test", "staff-test-password-123");
  expect(
    (
      await staff.request.patch("/api/account", {
        headers: { Origin: "https://evil.example" },
        data: { name: "Hacked" },
      })
    ).status(),
  ).toBe(403);
  const own = await (await staff.request.get("/api/account")).json();
  expect(own.role).toBe("staff");
  expect(
    (
      await staff.request.post("/api/feedback", {
        headers: origin,
        data: { category: "general", comment: "Staff support message" },
      })
    ).status(),
  ).toBe(201);
  const messages = await (await staff.request.get("/api/feedback")).json();
  expect(messages.items).toHaveLength(1);
  expect(messages.items[0].comment).toBe("Staff support message");
  expect(
    (
      await staff.request.patch(`/api/feedback/${messages.items[0].id}`, {
        headers: origin,
        data: { resolved: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.delete("/api/account", {
        headers: origin,
        data: { password: "test-password-12345" },
      })
    ).status(),
  ).toBe(409);
  await staff.goto("/profile");
  await staff
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  const dialog = staff.getByRole("dialog");
  await dialog.getByLabel("Password", { exact: true }).fill("wrong");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("incorrect");
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("staff-test-password-123");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(staff).toHaveURL(/\/login/);
  expect((await staff.request.get("/api/account")).status()).toBe(401);
  const all = await (await page.request.get("/api/feedback")).json();
  expect(
    all.items.some((m: any) => m.comment === "Staff support message"),
  ).toBe(false);
  await context.close();
});
