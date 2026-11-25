import { it, expect } from "vitest";
import vite from "../../vite.config";
it("preserves the browser origin through both local proxies", () => {
  for (const mode of ["server", "preview"])
    expect(vite[mode].proxy["/api"].changeOrigin).toBe(false);
});
