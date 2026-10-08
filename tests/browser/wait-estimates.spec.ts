import { test, expect } from "@playwright/test";
test("optional branch wait estimates save, preserve legacy mode and never release seats", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("manager@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("test-password-12345");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Manage branches & staff" }).click();
  await page.getByLabel("Branch name", { exact: true }).fill("Estimate pilot");
  await page.getByLabel("Branch address").fill("Test street");
  await page.getByLabel("Seating capacity").fill("4");
  await page
    .getByRole("checkbox", { name: "Use service-based wait estimates" })
    .check();
  await page.getByLabel("Average service duration (minutes)").fill("45");
  await page
    .getByRole("button", { name: "Create branch", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Branch added.");
  const { branches } = await (await page.request.get("/api/branches")).json();
  const b = branches.find((b: any) => b.name === "Estimate pilot");
  expect(b.service_minutes).toBe(45);
  expect(branches.find((b: any) => b.id === "main").service_minutes).toBeNull();
  const create = async (name: string) => {
    const r = await page.request.post("/api/tickets?branch=" + b.id, {
      headers: { Origin: "http://localhost:3100" },
      data: { name, partySize: 2, phone: "", email: "" },
    });
    expect(r.status()).toBe(201);
    return r.json();
  };
  const a = await create("Estimate A"),
    c = await create("Estimate B"),
    d = await create("Estimate C");
  const view = await (await page.request.get("/api/guest/" + d.token)).json();
  expect(view.estimatedMinutes).toBe(45);
  expect(view.position).toBe(3);
  const row = page
    .locator(".branch-item")
    .filter({ has: page.getByText("Estimate pilot", { exact: true }) });
  await row.getByRole("button", { name: "Edit branch", exact: true }).click();
  await expect(
    page.getByLabel("Average service duration (minutes)"),
  ).toHaveValue("45");
  await page
    .getByRole("checkbox", { name: "Use service-based wait estimates" })
    .uncheck();
  await page.getByRole("button", { name: "Save branch", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Branch updated.");
  expect(
    (await (await page.request.get("/api/guest/" + d.token)).json())
      .estimatedMinutes,
  ).toBe(10);
  expect(
    (
      await (await page.request.get("/api/tickets?branch=" + b.id)).json()
    ).tickets.every((t: any) => t.status === "waiting"),
  ).toBe(true);
});
