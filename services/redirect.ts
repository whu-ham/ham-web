/**
 * @author Claude
 * @version 1.1
 * @date 2026/5/22
 *
 * Redirect URL validation utilities.
 *
 * Prevents open-redirect attacks by ensuring that user-supplied
 * redirect targets (`from` query param) are either:
 *
 *   1. A same-origin relative path (e.g. `/console`, `/sso-authorize?…`)
 *   2. An absolute URL whose host is in the allowed-hosts list
 *
 * Any other value is rejected and a safe fallback is returned instead.
 *
 * C2 fix: Allowed hosts are read from `NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS`
 * (comma-separated). When unset, only relative paths are allowed (safest).
 */

/**
 * Parse allowed hosts from env. Defaults to empty (relative-path-only mode).
 * Supports `ham.nowcent.cn,docs.ham.nowcent.cn` format.
 */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set(
	(process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS ?? '')
		.split(',')
		.map((h) => h.trim().toLowerCase())
		.filter(Boolean)
);

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
		// m2: Guard against backslash-encoded variants like `/\evil.com`
		// Using regex is more reliable than URL parsing for this edge case.
		if (!/^\/[^/\\]/.test(from) && from !== '/') {
			// Single `/` is fine; paths starting with /\ or // are rejected
			// by the checks above. This branch catches remaining oddities.
			return fallback;
		}
		// Extra guard: reject if the path escapes the origin via URL parsing
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
		// Check against configurable allowed hosts
		if (ALLOWED_HOSTS.size > 0) {
			for (const allowed of ALLOWED_HOSTS) {
				if (host === allowed || host.endsWith(`.${allowed}`)) {
					return from;
				}
			}
		}
	} catch {
		// Not a valid URL at all
	}

	return fallback;
};
