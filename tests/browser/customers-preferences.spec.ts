import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const catalog = JSON.parse(
  readFileSync(
    new URL("../../lib/locales/catalog.json", import.meta.url),
    "utf8",
  ),
);
const ur = (text: string) => catalog[text][5] as string;

test("customer branch selection stays in sync and Urdu applies to the directory, editor, dates and CSV", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".account-trigger")).toBeVisible();
  const headers = { Origin: "http://localhost:3100" };
  const save = async (data: object) => {
    expect(
      (await page.request.patch("/api/account", { headers, data })).ok(),
    ).toBe(true);
  };
  const create = async (name: string) => {
    const response = await page.request.post("/api/branches", {
      headers,
      data: { name, address: "Customer preference test", capacity: 10 },
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  const first = await create("Customer scope east");
  const second = await create("Customer scope west");
  for (const [branch, name, email] of [
    [first, "Ada East", "ada.east@example.test"],
    [second, "Ben West", "ben.west@example.test"],
  ]) {
    const response = await page.request.post(
      `/api/tickets?branch=${branch.id}`,
      {
        headers,
        data: { name, email, phone: "", partySize: 2, consent: true },
      },
    );
    expect(response.status()).toBe(201);
  }
  try {
    await save({ language: "en" });
    await page.goto("/");
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: "Customers", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Customer branch", exact: true })
      .selectOption(first.id);
    await expect(
      page.getByRole("combobox", { name: "Branch", exact: true }),
    ).toHaveValue(first.id);
    await expect(page.locator(".customer-list-row")).toContainText("Ada East");
    await page
      .getByRole("combobox", { name: "Customer branch", exact: true })
      .selectOption(second.id);
    await expect(
      page.getByRole("combobox", { name: "Branch", exact: true }),
    ).toHaveValue(second.id);
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: "Queue", exact: false })
      .click();
    await expect(page.locator(".ticket-list")).toContainText("Ben West");
    await expect(page.locator(".ticket-list")).not.toContainText("Ada East");
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: "Customers", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Branch", exact: true })
      .selectOption(first.id);
    await expect(
      page.getByRole("combobox", { name: "Customer branch", exact: true }),
    ).toHaveValue(first.id);
    await expect(page.locator(".customer-list-row")).toContainText("Ada East");

    await save({ language: "ur" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: ur("Customers"), exact: true })
      .click();
    await page
      .getByRole("combobox", { name: ur("Customer branch"), exact: true })
      .selectOption(first.id);
    const row = page.locator(".customer-list-row");
    await expect(row).toContainText(ur("Total visits"));
    await expect(row).toContainText(ur("Not granted"));
    await expect(row.locator(".customer-row-visits span")).toHaveText("۱");
    await expect(row.locator(".customer-row-email bdi")).toHaveAttribute(
      "dir",
      "ltr",
    );
    await row.locator(".customer-edit-button").click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: ur("Customer details"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel(ur("Notes (optional)"), { exact: true }),
    ).toBeVisible();
    await expect(dialog.locator(".customer-activity-row strong")).toContainText(
      "۱",
    );
    await expect(dialog.locator(".customer-activity-row small")).toContainText(
      "۲",
    );
    await dialog
      .getByRole("button", { name: ur("Cancel"), exact: true })
      .click();
    await page.locator(".customer-date-button").click();
    await expect(
      dialog.locator(".customer-calendar button").first(),
    ).toHaveText("۱");
    await dialog
      .getByLabel(ur("Start date"), { exact: true })
      .fill("2020-01-01");
    await dialog.getByLabel(ur("End date"), { exact: true }).fill("2099-12-31");
    await dialog
      .getByRole("button", { name: ur("Apply"), exact: true })
      .click();
    await expect(page.locator(".customer-date-button")).toContainText("۲۰۲۰");
    await expect(row).toContainText("Ada East");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: ur("Export CSV"), exact: true })
      .click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    let content = "";
    for await (const chunk of stream!) content += chunk.toString();
    expect(content).toContain(ur("Name"));
    expect(content).toContain(ur("Marketing consent"));
    expect(content).toContain(ur("Not granted"));
    expect(content).toContain("ada.east@example.test");
    await page.screenshot({
      path: "/tmp/tableq-customers-urdu.png",
      fullPage: true,
    });
  } finally {
    await save({ language: "en" });
  }
});
