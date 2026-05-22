/**
 * @author Claude
 * @version 1.2
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
 *
 * M4 fix: Simplified relative-path validation — single URL-parse check
 * replaces the complex regex + multi-branch logic.
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
	// M4: Simplified — reject protocol-relative (//) and backslash variants (/\),
	// then use URL parsing as the final authority.
	if (
		from.startsWith('/') &&
		!from.startsWith('//') &&
		!from.startsWith('/\\')
	) {
		try {
			const u = new URL(from, 'https://placeholder.invalid');
			if (u.host === 'placeholder.invalid') return from;
		} catch {
			// Invalid URL — fall through to fallback
		}
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
