/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 12:55:00
 *
 * Shared port for the backend stub, imported by both the Playwright
 * config (to build `HAM_BACKEND_ORIGIN`) and the stub entry point.
 * Kept in its own module so neither side has to depend on the other.
 */

/** Port the backend stub listens on. */
export const STUB_PORT = 4123;

/** Origin the Next.js app should call. */
export const STUB_ORIGIN = `http://127.0.0.1:${STUB_PORT}`;
