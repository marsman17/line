export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export function csv(filename: string, rows: (string | number)[][]) {
  const content = rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v)
              .replace(/^[=+@\-\t\r]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export type Restaurant = {
  name: string;
  address: string;
  capacity: number;
  pushEnabled: boolean;
  smsEnabled: boolean;
  vapidKey: string;
  waiting: number;
  appUrl: string;
};
