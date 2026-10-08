/** Guest links are navigations only. Never fetch user-provided URLs server-side. */
export function restaurantUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(trimmed))
    throw Error("Enter a valid http:// or https:// URL without login details.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw Error("Enter a valid http:// or https:// URL without login details.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw Error("Enter a valid http:// or https:// URL without login details.");
  return url.href;
}
export function validRestaurantUrl(value: string) {
  try {
    restaurantUrl(value);
    return true;
  } catch {
    return false;
  }
}
