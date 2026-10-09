import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
type Language = "en" | "es" | "pt" | "de" | "fr" | "it" | "ur";
const languages: Language[] = ["en", "es", "pt", "de", "fr", "it", "ur"];
const catalog = JSON.parse(
  readFileSync(
    new URL("../../lib/locales/catalog.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string[]>;
const number = (language: Language, value: number) =>
  new Intl.NumberFormat(
    language === "ur" ? "ur-PK-u-nu-arabext" : language,
  ).format(value);

const origin = { Origin: "http://localhost:3100" };
const text = (
  key: string,
  language: Language = "en",
  values: Record<string, string | number> = {},
) => {
  const translated =
    language === "en" ? key : catalog[key]?.[languages.indexOf(language) - 1];
  if (translated === undefined)
    throw Error(`Missing ${language} translation: ${key}`);
  return translated.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    return value === undefined
      ? placeholder
      : typeof value === "number"
        ? number(language, value)
        : value;
  });
};

test.beforeEach(() => {
  // The browser suite shares an IP and exercises many valid sign-ins. Reset only
  // its login budget in the disposable database created by playwright.config.ts;
  // production rate limiting remains enabled and is never modified here.
  const testDatabase = new DatabaseSync("/tmp/tableq-e2e/tableq.sqlite");
  try {
    testDatabase.exec("PRAGMA busy_timeout=5000");
    testDatabase
      .prepare("DELETE FROM rate_limits WHERE key LIKE 'login:%'")
      .run();
  } finally {
    testDatabase.close();
  }
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator(".account-trigger")).toBeVisible();
}

async function fixture(page: Page, suffix: string) {
  const response = await page.request.post("/api/branches", {
    headers: origin,
    data: {
      name: `Verified features ${suffix}`,
      address: "Test restaurant",
      capacity: 20,
    },
  });
  expect(response.status()).toBe(201);
  const branch = await response.json();
  const createVisit = async (
    name: string,
    email: string,
    priority: boolean,
    noShow = false,
  ) => {
    const joined = await page.request.post(`/api/tickets?branch=${branch.id}`, {
      headers: origin,
      data: { name, email, phone: "", partySize: 2, priority, consent: false },
    });
    expect(joined.status()).toBe(201);
    const ticket = await joined.json();
    const change = (data: object) =>
      page.request.patch(`/api/tickets/${ticket.id}?branch=${branch.id}`, {
        headers: origin,
        data,
      });
    expect((await change({ status: "notified" })).ok()).toBe(true);
    expect(
      (await change({ status: noShow ? "cancelled" : "served", noShow })).ok(),
    ).toBe(true);
    if (!noShow) expect((await change({ action: "release" })).ok()).toBe(true);
  };
  await createVisit("Amina Khan", "amina@features.example", true);
  await createVisit("Amina Khan", "amina@features.example", false);
  await createVisit("Bilal Ali", "bilal@features.example", false, true);
  await page.goto("/app");
  await page.getByLabel("Branch", { exact: true }).selectOption(branch.id);
  await expect(page.getByLabel("Branch", { exact: true })).toHaveValue(
    branch.id,
  );
  return branch;
}

async function navigation(
  page: Page,
  tab: "Customers" | "Analytics",
  language: Language = "en",
) {
  if ((page.viewportSize()?.width || 1280) <= 760) {
    if (
      !(await page
        .locator(".sidebar")
        .evaluate((el) => el.classList.contains("open")))
    ) {
      await page
        .getByRole("button", {
          name: text("Open navigation", language),
          exact: true,
        })
        .click();
    }
  }
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: text(tab, language), exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: text(
        tab === "Customers" ? "Customers" : "Understand every wait.",
        language,
      ),
      exact: true,
    }),
  ).toBeVisible();
}

async function screenshot(page: Page, feature: string, mobile = false) {
  await page.screenshot({
    path: `/tmp/tableq-verified-${feature}-${mobile ? "mobile" : "desktop"}.png`,
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("Customers reference controls actually filter, sort, edit profiles and export visit history", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  await fixture(page, "customer controls");
  await navigation(page, "Customers");
  const rows = page.locator(".customer-list-row");
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole("status")).toContainText("2 customers match");
  await expect(page.getByLabel("Customer visit source")).toHaveValue("queue");
  await expect(page.getByLabel("Customer branch")).toBeVisible();

  await page.getByLabel("Search customers").fill("Amina");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("amina@features.example");
  await expect(rows.first().locator(".customer-row-visits")).toContainText("2");
  await page.getByLabel("Search customers").fill("");
  await expect(rows).toHaveCount(2);
  await page.getByLabel("Priority filter").selectOption("yes");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Amina Khan");
  await page.getByLabel("Priority filter").selectOption("no");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Bilal Ali");
  await page.getByLabel("Priority filter").selectOption("any");
  await expect(rows).toHaveCount(2);

  await page.getByLabel("Sort customers").selectOption("name");
  await expect(rows.first()).toContainText("Amina Khan");
  await page
    .getByRole("button", { name: "Sort descending", exact: true })
    .click();
  await expect(rows.first()).toContainText("Bilal Ali");
  await page.getByLabel("Sort customers").selectOption("visits");
  await expect(rows.first()).toContainText("Amina Khan");
  await expect(
    page.getByLabel("Sort customers").locator("option[value=next]"),
  ).toBeDisabled();

  await page
    .getByRole("button", { name: "Edit customer Amina Khan", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Customer Amina Khan",
    exact: true,
  });
  await expect(
    dialog.getByRole("heading", { name: "Customer details", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Email (optional)")).toHaveValue(
    "amina@features.example",
  );
  await expect(
    dialog.getByRole("heading", { name: "Activity", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".customer-activity-row")).toHaveCount(2);
  await expect(dialog.getByText("Showed", { exact: true })).toHaveCount(2);
  await expect(dialog.locator(".customer-activity-summary")).toContainText(
    "Total visits:2",
  );
  await dialog.getByLabel("Phone (optional)").fill("+923001234567");
  await dialog.getByLabel("Notes (optional)").fill("Prefers a quiet corner.");
  await dialog
    .getByRole("switch", { name: "Marketing consent", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(rows.filter({ hasText: "Amina Khan" })).toContainText(
    "+923001234567",
  );
  await page.getByLabel("Marketing consent filter").selectOption("granted");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Amina Khan");
  await page.getByLabel("Marketing consent filter").selectOption("not-granted");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Bilal Ali");
  await page.getByLabel("Marketing consent filter").selectOption("any");
  await expect(rows).toHaveCount(2);
  await page
    .getByRole("button", { name: "Edit customer Amina Khan", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Customer Amina Khan",
    exact: true,
  });
  await expect(dialog.getByLabel("Notes (optional)")).toHaveValue(
    "Prefers a quiet corner.",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit customer Bilal Ali", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Customer Bilal Ali",
    exact: true,
  });
  await expect(dialog.locator(".customer-activity-summary")).toContainText(
    "No-show: 1",
  );
  await expect(dialog.locator(".customer-activity-badge")).toHaveText(
    "No-show",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

  await page
    .getByRole("button", { name: "Last 365 days", exact: true })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Customer date range",
    exact: true,
  });
  for (const name of [
    "Today",
    "Yesterday",
    "Last 7 days",
    "Last 30 days",
    "Last 60 days",
    "Last 90 days",
    "Last 365 days",
  ]) {
    await expect(
      dialog.getByRole("button", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(dialog.getByLabel("Start date")).toBeVisible();
  await expect(dialog.getByLabel("End date")).toBeVisible();
  await expect(
    dialog.getByRole("group", { name: "Select date range", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Yesterday", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No customers match.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  dialog = page.getByRole("dialog", {
    name: "Customer date range",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Today", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(rows).toHaveCount(2);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tableq-customers.csv");
  const contents = readFileSync((await download.path())!, "utf8");
  expect(contents).toContain("Amina Khan");
  expect(contents).toContain("Bilal Ali");
  expect(contents).toContain("Prefers a quiet corner.");
  expect(errors).toEqual([]);
});

test("preset and hex color controls persist across Customers and Analytics; Urdu translates full content", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  const original = await (await page.request.get("/api/account")).json();
  const branch = await fixture(page, "appearance and Urdu");
  try {
    await navigation(page, "Customers");
    await expect(page.locator(".customer-list-row")).toHaveCount(2);
    await page.locator(".sidebar .account-color-shortcut").click();
    let dialog = page.getByRole("dialog", {
      name: "Website color",
      exact: true,
    });
    await expect(
      dialog.getByLabel("Choose color", { exact: true }),
    ).toHaveAttribute("type", "color");
    await dialog.getByRole("button", { name: "Blue", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Save color", exact: true })
      .click();
    await expect(page.locator("html")).toHaveCSS("--accent", "#3b82f6");
    await expect(
      dialog.getByText("Website color saved.", { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel("Hex color", { exact: true }).fill("#123abc");
    await dialog
      .getByRole("button", { name: "Save color", exact: true })
      .click();
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await expect(
      dialog.getByLabel("Choose color", { exact: true }),
    ).toHaveValue("#123abc");
    await expect(dialog.locator(".color-preview code")).toHaveText("#123abc");
    await screenshot(page, "colors");
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(page.locator(".customer-export")).toHaveCSS(
      "background-color",
      "rgb(18, 58, 188)",
    );
    await navigation(page, "Analytics");
    await expect(page.locator(".funnel-track > i").first()).toHaveCSS(
      "background-color",
      "rgb(18, 58, 188)",
    );
    await expect(page.locator(".bar").first()).toHaveCSS(
      "background-color",
      "rgb(18, 58, 188)",
    );
    await page.reload();
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await page.getByLabel("Branch", { exact: true }).selectOption(branch.id);
    await navigation(page, "Customers");
    await expect(page.locator(".customer-export")).toHaveCSS(
      "background-color",
      "rgb(18, 58, 188)",
    );
    await page.locator(".account-trigger").click();
    await page
      .getByRole("button", { name: "Website color", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Website color", exact: true });
    await expect(dialog.getByLabel("Hex color", { exact: true })).toHaveValue(
      "#123abc",
    );
    await dialog.getByLabel("Hex color", { exact: true }).fill("invalid");
    await dialog
      .getByRole("button", { name: "Save color", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Enter a valid hex color.",
    );
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await dialog.getByLabel("Hex color", { exact: true }).fill("#123abc");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeInViewport();
    await expect(
      dialog.getByLabel("Hex color", { exact: true }),
    ).toBeInViewport();
    await screenshot(page, "colors", true);
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.setViewportSize({ width: 1280, height: 900 });

    // Change language through the real menu, so this proves more than an API preference update.
    await page.locator(".account-trigger").click();
    await page.getByRole("button", { name: "Language", exact: true }).click();
    await page.getByRole("button", { name: "اردو", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ur");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator(".account-trigger").click();
    await navigation(page, "Customers", "ur");
    await expect(page.locator(".customer-list-row")).toHaveCount(2);
    const directory = page.getByRole("region", {
      name: text("Customer directory", "ur"),
      exact: true,
    });
    await expect(
      directory.getByRole("button", {
        name: text("Export CSV", "ur"),
        exact: true,
      }),
    ).toBeVisible();
    for (const label of [
      "Customer branch",
      "Customer visit source",
      "Search customers",
      "Priority filter",
      "Marketing consent filter",
      "Sort customers",
    ]) {
      await expect(
        directory.getByLabel(text(label, "ur"), { exact: true }),
      ).toBeVisible();
    }
    for (const label of ["Total visits", "Marketing", "Phone", "Email"]) {
      await expect(
        directory
          .locator(".customer-list-row")
          .first()
          .getByText(text(label, "ur"), { exact: true }),
      ).toBeVisible();
    }
    await expect(directory.getByRole("status")).toHaveText(
      text("{count} customers match", "ur", { count: 2 }),
    );
    await expect(
      directory
        .locator(".customer-row-visits")
        .filter({ hasText: number("ur", 2) }),
    ).toHaveCount(1);
    await expect(
      directory.getByText("Amina Khan", { exact: true }),
    ).toBeVisible();
    await directory
      .getByRole("button", {
        name: text("Edit customer {value0}", "ur", { value0: "Amina Khan" }),
        exact: true,
      })
      .click();
    dialog = page.getByRole("dialog", {
      name: text("Customer {value0}", "ur", { value0: "Amina Khan" }),
      exact: true,
    });
    for (const heading of ["Customer details", "Activity"]) {
      await expect(
        dialog.getByRole("heading", { name: text(heading, "ur"), exact: true }),
      ).toBeVisible();
    }
    for (const label of [
      "Name (optional)",
      "Phone (optional)",
      "Email (optional)",
      "Notes (optional)",
    ]) {
      await expect(
        dialog.getByLabel(text(label, "ur"), { exact: true }),
      ).toBeVisible();
    }
    await expect(
      dialog.getByRole("switch", {
        name: text("Marketing consent", "ur"),
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByText(text("Showed", "ur"), { exact: true }),
    ).toHaveCount(2);
    await dialog
      .getByRole("button", { name: text("Cancel", "ur"), exact: true })
      .click();
    await screenshot(page, "customers");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, "customers", true);
    await page.setViewportSize({ width: 1280, height: 900 });

    await navigation(page, "Analytics", "ur");
    const main = page.getByRole("main");
    for (const label of [
      "Guests welcomed",
      "Average wait",
      "Seating rate",
      "Cancelled",
      "From check-in to table-ready",
      "From the first hello to a seat at the table.",
      "Find your busiest moments. Plan your warmest welcome.",
      "Your local time · all 24 hours",
      "A rhythm to every week.",
      "Total guests during the selected period",
      "Average minutes from check-in to table-ready.",
      "Party size · based on notified guests",
    ]) {
      await expect(
        main.getByText(text(label, "ur"), { exact: true }),
      ).toBeVisible();
    }
    for (const heading of [
      "The guest journey",
      "Demand by hour",
      "Demand by weekday",
      "Wait by party size",
    ]) {
      await expect(
        main.getByRole("heading", { name: text(heading, "ur"), exact: true }),
      ).toBeVisible();
    }
    for (const label of ["Joined", "Notified", "Seated"]) {
      await expect(
        main
          .locator(".funnel-stage")
          .getByText(text(label, "ur"), { exact: true }),
      ).toBeVisible();
    }
    await expect(
      main.getByText(
        text("{value0} no-shows · {value1} other cancellations", "ur", {
          value0: 1,
          value1: 0,
        }),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(main.locator(".stats-grid .stat-card").first()).toContainText(
      number("ur", 6),
    );
    const hourly = main.locator(".chart-panel").filter({
      has: page.getByRole("heading", {
        name: text("Demand by hour", "ur"),
        exact: true,
      }),
    });
    await expect(hourly.locator(".bar-column")).toHaveCount(24);
    await expect(main.locator(".bar-chart").first()).toHaveAttribute(
      "aria-label",
      new RegExp(text("guests", "ur")),
    );
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    await screenshot(page, "analytics");
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, "analytics", true);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ur");
    await expect(page.locator("html")).toHaveCSS("--accent", "#123abc");
    expect(errors).toEqual([]);
  } finally {
    const restored = await page.request.patch("/api/account", {
      headers: origin,
      data: {
        language: original.language,
        theme: original.theme,
        accent: original.accent,
      },
    });
    expect(restored.ok()).toBe(true);
  }
});
