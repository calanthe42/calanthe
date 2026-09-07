import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest had no config until now, so it resolved no path aliases — the gap
 * recorded when the boundary folders were introduced ("the first aliased
 * import in a test will need vite-tsconfig-paths or an equivalent
 * resolve.alias"). This is that equivalent.
 *
 * The aliases are declared here rather than pulling in vite-tsconfig-paths
 * because there are four of them, they change roughly never, and a second
 * source of truth for a dependency is worse than four explicit lines. They
 * must stay in step with `paths` in tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@frontend": path.resolve(dirname, "./src/frontend"),
      "@backend": path.resolve(dirname, "./src/backend"),
      "@admin": path.resolve(dirname, "./src/admin"),
      "@shared": path.resolve(dirname, "./src/shared"),
      "@payload-config": path.resolve(dirname, "./src/payload.config.ts"),
      "@": path.resolve(dirname, "./src"),
    },
  },
  test: {
    /* Unit tests only. The permission suites in scripts/ drive a real server
       and a real database, so they are run explicitly, not on every save. */
    include: ["src/**/*.test.ts"],
  },
});
