/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Redirect URL validation utilities.
 *
 * Prevents open-redirect attacks by ensuring that user-supplied
 * redirect targets (`from` query param) are either:
 *
 *   1. A same-origin relative path (e.g. `/console`, `/sso-authorize?…`)
 *   2. An absolute URL whose host is `ham.nowcent.cn` or a subdomain
 *      of `ham.nowcent.cn` (e.g. `https://ham.nowcent.cn/console`,
 *      `https://docs.ham.nowcent.cn`)
 *
 * Any other value is rejected and a safe fallback is returned instead.
 */

const ALLOWED_HOST = 'ham.nowcent.cn';

/**
 * Validate a user-supplied redirect URL.
 *
 * @param from  The raw `from` query parameter value.
 * @param fallback  URL to return when validation fails (default `/console`).
 * @returns The validated URL, or `fallback` if invalid.
 */
export const safeRedirect = (
	from: string | null | undefined,
	fallback = '/console'
): string => {
	if (!from) return fallback;

	// --- Relative path ---
	// Must start with `/` but NOT `//` (which would be protocol-relative).
	if (from.startsWith('/') && !from.startsWith('//')) {
		// Extra guard: reject backslash-encoded variants like `/\evil.com`
		try {
			const resolved = new URL(from, 'https://placeholder.invalid');
			if (resolved.host !== 'placeholder.invalid') return fallback;
		} catch {
			return fallback;
		}
		return from;
	}

	// --- Absolute URL ---
	try {
		const url = new URL(from);
		// Only allow https: (and http: for local dev)
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;

		const host = url.hostname.toLowerCase();
		if (host === ALLOWED_HOST || host.endsWith(`.${ALLOWED_HOST}`)) {
			return from;
		}
	} catch {
		// Not a valid URL at all
	}

	return fallback;
};
