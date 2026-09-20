import { register } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Entry point for `--import`, which installs the alias hooks on the module
 * loader thread. Node will not accept the hooks file directly.
 *
 *   node --env-file=.env.local --import ./scripts/register-aliases.mjs \
 *        scripts/<suite>.mts
 */
register("./alias-hooks.mjs", pathToFileURL(`${import.meta.dirname}/`));
