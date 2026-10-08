import { test, expect } from "@playwright/test";
test("branch website/menu settings persist, stay scoped, validate URLs and appear on guest pages", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page.getByLabel("Branch name", { exact: true }).fill("Link pilot");
  await page.getByLabel("Branch address").fill("Link street");
  await page.getByLabel("Website URL (optional)").fill("https://example.com");
  await page.getByLabel("Menu URL (optional)").fill("https://example.com/menu");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Branch added.");
  const { branches } = await (await page.request.get("/api/branches")).json();
  const b = branches.find((x: any) => x.name === "Link pilot");
  expect(b.website_url).toBe("https://example.com/");
  expect(branches.find((x: any) => x.id === "main").website_url).toBe("");
  const payload = { name: b.name, address: b.address, capacity: b.capacity };
  const headers = { Origin: "http://localhost:3100" };
  const preserved = await page.request.patch("/api/branches/" + b.id, {
    headers,
    data: payload,
  });
  expect((await preserved.json()).menu_url).toBe("https://example.com/menu");
  const invalid = await page.request.patch("/api/branches/" + b.id, {
    headers,
    data: { ...payload, menuUrl: "javascript:alert(1)" },
  });
  expect(invalid.status()).toBe(400);
  const guest = await page.request.post("/api/tickets?branch=" + b.id, {
    headers,
    data: { name: "Link guest", partySize: 1, phone: "", email: "" },
  });
  const { token } = await guest.json();
  for (const route of ["/check-in?branch=" + b.id, "/guest/" + token]) {
    await page.goto(route);
    await expect(page.getByRole("link", { name: "View menu" })).toHaveAttribute(
      "href",
      "https://example.com/menu",
    );
    await expect(
      page.getByRole("link", { name: "Visit website" }),
    ).toHaveAttribute("target", "_blank");
    await expect(
      page.getByRole("link", { name: "Visit website" }),
    ).toHaveAttribute("rel", "noopener noreferrer");
  }
  await page.request.patch("/api/branches/" + b.id, {
    headers,
    data: { ...payload, websiteUrl: "", menuUrl: "" },
  });
  await page.goto("/check-in?branch=" + b.id);
  await expect(page.getByRole("heading", { name: "Link pilot" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Restaurant links" }),
  ).toHaveCount(0);
});
