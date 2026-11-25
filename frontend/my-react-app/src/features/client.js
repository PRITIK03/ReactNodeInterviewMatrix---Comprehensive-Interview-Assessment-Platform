export async function api(path, method = "GET", body, headers = {}) {
  const raw = body instanceof File;
  const res = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body && !raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : data.detail?.[0]?.msg || "Request failed. Please retry.",
    );
  return data;
}
export const date = (t) => new Date(t * 1000).toLocaleString();

export function displayName(value = "") {
  return (
    { coding: "Python coding", aptitude: "Aptitude", tcs: "TCS" }[value] ||
    value.charAt(0).toUpperCase() + value.slice(1)
  );
}
