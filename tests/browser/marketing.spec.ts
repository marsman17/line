import { test, expect } from "@playwright/test";
test("public website, desktop/mobile menus, pricing, FAQs and ROI calculator", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A better wait. A warmer welcome.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Product", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Queue management Add guests, track their position, and keep your queue moving.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Check-in page A branded welcome, ready for every customer arrival.",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Check-in page", exact: true }),
  ).toBeVisible();
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Unlimited customers. Simple pricing." }),
  ).toBeVisible();
  await expect(
    page.locator('[class*="price"]').filter({ hasText: "$27" }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[class*="price"]').filter({ hasText: "$32" }).first(),
  ).toBeVisible();
  await page
    .getByText("Are these live subscription plans?", { exact: true })
    .click();
  await expect(
    page.getByText(/This installation has no subscription checkout/),
  ).toBeVisible();
  await page.goto("/website/resources/roi-calculator");
  await page.getByLabel("Daily visitors").fill("200");
  await expect(page.getByText("$4,500", { exact: true })).toBeVisible();
  await page.goto("/website");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Solutions", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Restaurants & cafes Welcome walk-ins at restaurants, cafes, and food trucks.",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Restaurants & cafes", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/website");
  await page.screenshot({
    path: "/tmp/tableq-website-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/tableq-website-desktop.png",
    fullPage: true,
  });
  await page.goto("/pricing");
  await page.screenshot({
    path: "/tmp/tableq-pricing-desktop.png",
    fullPage: true,
  });
  for (const url of [
    "/website/about",
    "/website/contact",
    "/website/privacy",
    "/website/terms",
    "/website/sitemap",
    "/website/resources/blog",
    "/website/resources/help-center",
    "/website/product/appointments",
    "/website/product/table-management",
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toBeVisible();
  }
  await page.goto("/website/not-a-page");
  await expect(
    page.getByRole("heading", { name: "This table doesn’t exist." }),
  ).toBeVisible();
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
});
