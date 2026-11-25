export async function api(path, method = "GET", body, headers = {}, signal) {
  const raw = body instanceof File;
  const res = await fetch("/api/v1" + path, {
    method,
    signal,
    credentials: "same-origin",
    headers: {
      ...(body && !raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  }).catch(error => {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not reach the workspace. Check your connection and try again.");
  });
  let data = {};
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      if (res.ok)
        throw new Error(
          "The workspace returned an unreadable response. Try again.",
        );
    }
  }
  if (!res.ok) {
    const error = new Error(
      typeof data?.detail === "string"
        ? data.detail
        : data?.detail?.[0]?.msg || "Request failed. Please retry.",
    );
    error.status = res.status;
    throw error;
  }
  return data;
}
export const date = (t) => new Date(t * 1000).toLocaleString();

export function displayName(value = "") {
  return (
    { coding: "Python coding", aptitude: "Aptitude", tcs: "TCS" }[value] ||
    value.charAt(0).toUpperCase() + value.slice(1)
  );
}
