import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("company logo upload, guest branding, replacement, removal and stable theme options", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  const png = await sharp({
    create: {
      width: 120,
      height: 60,
      channels: 4,
      background: { r: 12, g: 140, b: 30, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const upload = page.getByLabel("Upload company logo — The Olive Table", {
    exact: true,
  });
  await upload.setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(page.getByRole("status")).toHaveText("Company logo saved.");
  await expect(page.locator(".branch-logo-preview img").first()).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".restaurant-avatar img")).toBeVisible();
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto("/check-in");
  await expect(guest.locator(".guest-logo img")).toBeVisible();
  expect(
    (await guest.request.get("/api/branches/main/logo")).headers()[
      "content-type"
    ],
  ).toBe("image/png");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const dark = page.getByRole("button", { name: "Dark", exact: true });
  const before = await dark.locator("span").first().boundingBox();
  await dark.click();
  await expect(dark).toHaveAttribute("aria-pressed", "true");
  const after = await dark.locator("span").first().boundingBox();
  expect(after?.x).toBe(before?.x);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(dark).toHaveAttribute("aria-pressed", "false");
  expect((await dark.locator("span").first().boundingBox())?.x).toBe(before?.x);
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await upload.setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake"),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("invalid");
  await expect(page.locator(".branch-logo-preview img").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove logo", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Company logo removed.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".restaurant-avatar img")).toHaveCount(0);
  await guest.reload();
  await expect(guest.locator(".guest-logo img")).toHaveCount(0);
  await context.close();
});
