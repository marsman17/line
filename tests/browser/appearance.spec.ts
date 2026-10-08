import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const catalog = JSON.parse(
  readFileSync(
    new URL("../../lib/locales/catalog.json", import.meta.url),
    "utf8",
  ),
);
const supportedLanguages = ["en", "es", "pt", "de", "fr", "it", "ur"];
const translate = (lang: string, text: string) =>
  lang === "en" ? text : catalog[text][supportedLanguages.indexOf(lang) - 1];
test("workspace languages, Urdu direction, custom accents and persistence", async ({
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
  await expect(page.locator(".account-trigger")).toBeVisible();
  const save = async (data: object) => {
    const r = await page.request.patch("/api/account", {
      headers: { Origin: "http://localhost:3100" },
      data,
    });
    expect(r.ok()).toBe(true);
  };
  try {
    for (const language of supportedLanguages) {
      await save({ language });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      for (const [name, title] of [
        ["Overview", "A warm welcome starts here."],
        ["Queue", "Your queue."],
        ["Customers", "Customers"],
        ["Analytics", "Understand every wait."],
      ]) {
        await page
          .locator(".sidebar nav")
          .getByRole("button", {
            name: translate(language, name),
            exact: false,
          })
          .click();
        await expect(
          page.getByRole("heading", {
            name: translate(language, title),
            exact: true,
          }),
        ).toBeVisible();
      }
      if (language === "ur") {
        await page.screenshot({
          path: "/tmp/tableq-urdu-desktop.png",
          fullPage: true,
        });
        await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
        await page.setViewportSize({ width: 390, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator(".sidebar")).not.toBeInViewport();
        await page.screenshot({
          path: "/tmp/tableq-urdu-mobile.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 1280, height: 900 });
      }
    }
    await save({ language: "en", theme: "dark" });
    await page.goto("/profile#appearance");
    await page.getByRole("button", { name: "Blue", exact: true }).click();
    await page.getByRole("button", { name: "Save color", exact: true }).click();
    await expect(
      page.getByText("Website color saved.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("--accent", "#3b82f6");
    await page.getByLabel("Hex color", { exact: true }).fill("#123abc");
    await page.getByRole("button", { name: "Save color", exact: true }).click();
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await page.reload();
    await expect(page.getByLabel("Hex color", { exact: true })).toHaveValue(
      "#123abc",
    );
    await page.getByLabel("Hex color", { exact: true }).fill("invalid");
    await page.getByRole("button", { name: "Save color", exact: true }).click();
    await expect(
      page.getByText("Enter a valid hex color.", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await save({ theme: "light" });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    expect(errors).toEqual([]);
  } finally {
    await save({ language: "en", accent: "#f2aa35", theme: "system" });
  }
});
