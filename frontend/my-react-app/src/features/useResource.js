import { useEffect, useState } from "react";
import { api } from "./client";
export function useResource(path, revision = 0) {
  const [data, set] = useState(null),
    [error, fail] = useState("");
  useEffect(() => {
    let active = true;
    set(null);
    fail("");
    if (path)
      api(path)
        .then((v) => active && set(v))
        .catch((e) => active && fail(e.message));
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, error };
}
