// Shared by the production build (scripts/build.js) and tests/devOnly.test.js.
/** __DEV__ = false drops the dev-only console helpers (src/debug.js, e.g. __trip) from the bundle. */
export const PROD_DEFINE = { __DEV__: 'false' };
