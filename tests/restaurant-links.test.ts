import { test } from "node:test";
import assert from "node:assert/strict";
import { restaurantUrl } from "../lib/restaurant-links.ts";
test("restaurant links accept web navigations and reject executable or credential-bearing URLs", () => {
  assert.equal(
    restaurantUrl("  https://example.com/menu?q=dinner#food  "),
    "https://example.com/menu?q=dinner#food",
  );
  assert.equal(restaurantUrl(""), "");
  assert.equal(restaurantUrl("http://example.com"), "http://example.com/");
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com",
    "/menu",
    "https://name:password@example.com",
    "https://example.com\\bad",
    "https://example.com/\nmenu",
  ])
    assert.throws(() => restaurantUrl(value));
});
