/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/10 17:10:00
 *
 * Ports the e2e harness uses, in one place so the config, the fixtures
 * and the setup step cannot drift apart.
 */

/** Port the backend stub listens on. */
export const STUB_PORT = 4123;

/** Port the Next.js app is served on. Deliberately not 3000. */
export const APP_PORT = 3210;

/** Origins derived from the ports above. */
export const STUB_ORIGIN = `http://127.0.0.1:${STUB_PORT}`;

/**
 * Next normalises its absolute redirects to `localhost`, so the suite must
 * reach the app on that exact host. Using 127.0.0.1 makes the app hand the
 * browser a redirect to a different origin, which drops the session cookie
 * and turns every authenticated flow into a bounce back to /login.
 */
export const APP_ORIGIN = `http://localhost:${APP_PORT}`;
