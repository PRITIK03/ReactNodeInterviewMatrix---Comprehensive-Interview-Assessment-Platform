import { useEffect, useState } from "react";
import { api } from "./client";

export function useResource(path, revision = 0, allPages = false) {
  const [result, setResult] = useState(null);
  const [generation, refresh] = useState(0);
  const current =
    result &&
    result.path === path &&
    result.revision === revision &&
    result.generation === generation
      ? result
      : null;

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const read = (url) => api(url, "GET", undefined, {}, controller.signal);
    async function load() {
      if (!allPages) return read(path);
      const rows = [];
      const separator = path.includes("?") ? "&" : "?";
      for (;;) {
        const page = await read(
          path + separator + "limit=100&offset=" + rows.length,
        );
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    }
    const save = (fields) => {
      if (!controller.signal.aborted)
        setResult({ path, revision, generation, ...fields });
    };
    load().then(
      (data) => save({ data }),
      (failure) => save({ failure }),
    );
    return () => controller.abort();
  }, [path, revision, allPages, generation]);

  return {
    data: current?.data ?? null,
    error: current?.failure?.message || "",
    status: current?.failure?.status,
    retry: () => refresh((n) => n + 1),
  };
}
