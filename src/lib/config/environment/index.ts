/**
 * Canonical environment configuration (Sprint 9.5 Phase 6).
 */

export { ENV_ALIASES } from "./aliases";
export type { EnvAliasEntry } from "./aliases";
export {
  resolveEnv,
  resolveEnvFlag,
  formatEnvAliasMarkdown,
} from "./resolve";
