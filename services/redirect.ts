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

import {
	parseAllowedRedirectHosts,
	safeRedirectWithAllowedHosts,
} from '@/services/login-callback';

/**
 * Parse allowed hosts from env. Defaults to empty (relative-path-only mode).
 * Supports `ham.nowcent.cn,docs.ham.nowcent.cn` format.
 */
const ALLOWED_HOSTS: ReadonlySet<string> = parseAllowedRedirectHosts(
	process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_HOSTS
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
): string => safeRedirectWithAllowedHosts(from, ALLOWED_HOSTS, fallback);
