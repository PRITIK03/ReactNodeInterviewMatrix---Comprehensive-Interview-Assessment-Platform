import { useEffect, useState } from "react";
import { api } from "./client";
export function useResource(path, revision = 0, allPages = false) {
  const [data, set] = useState(null),
    [error, fail] = useState("");
  useEffect(() => {
    let active = true;
    set(null);
    fail("");
    async function load() {
      if (!allPages) return api(path);
      const rows = [];
      const separator = path.includes("?") ? "&" : "?";
      while (active) {
        const page = await api(
          path + separator + "limit=100&offset=" + rows.length,
        );
        rows.push(...page);
        if (page.length < 100) break;
      }
      return rows;
    }
    if (path)
      load()
        .then((v) => active && set(v))
        .catch((e) => active && fail(e.message));
    return () => {
      active = false;
    };
  }, [path, revision, allPages]);
  return { data, error };
}
