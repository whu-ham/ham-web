/**
 * @author Claude
 * @version 1.1
 * @date 2026/4/20
 *
 * Deep link helper: tries to hand the user off to the native HAM App via
 * `ham://sso-authorize?...`. If the tab is still visible after a short
 * timeout we assume the App is not installed and resolve with
 * `notInstalled = true` so the caller can show the fallback UI.
 */
'use client';

export interface DeepLinkResult {
	/** The UA backgrounded the tab, strongly suggesting the App opened. */
	launched: boolean;
	/**
	 * A synchronous navigation error was observed (e.g. the browser
	 * raised instead of silently ignoring the `ham://` scheme). When
	 * true, the caller should skip further retries and jump straight to
	 * the "App not installed" branch.
	 */
	failed?: boolean;
}

export interface DeepLinkOptions {
	url: string;
	timeoutMs?: number;
}

/**
 * tryLaunchDeepLink executes `location.href = url` and resolves once we
 * know whether the App took focus. Resolves `launched=true` as soon as
 * `visibilitychange` fires with `document.hidden=true` (App in foreground),
 * or `launched=false` after the timeout.
 *
 * A few browsers (notably some in-app webviews and Safari with blocked
 * custom schemes) throw synchronously when assigning a non-handled
 * `custom://` URL to `location.href`. We surface that as `failed=true`
 * so the orchestrator can short-circuit the wait and show the
 * "app-not-installed" UI immediately.
 */
export function tryLaunchDeepLink(
	opts: DeepLinkOptions
): Promise<DeepLinkResult> {
	const timeoutMs = opts.timeoutMs ?? 2500;

	return new Promise<DeepLinkResult>((resolve) => {
		let settled = false;
		const onVisibility = () => {
			if (document.hidden && !settled) {
				settled = true;
				window.clearTimeout(timer);
				document.removeEventListener('visibilitychange', onVisibility);
				resolve({ launched: true });
			}
		};

		const timer = window.setTimeout(() => {
			if (settled) return;
			settled = true;
			document.removeEventListener('visibilitychange', onVisibility);
			resolve({ launched: false });
		}, timeoutMs);

		document.addEventListener('visibilitychange', onVisibility);
		// Fire the deep link. On browsers without a registered handler this
		// is a silent no-op and the timer will fire the fallback branch.
		try {
			window.location.href = opts.url;
		} catch {
			// Synchronous failure — the UA rejected the custom scheme
			// outright. No point waiting for visibility to flip.
			if (!settled) {
				settled = true;
				window.clearTimeout(timer);
				document.removeEventListener('visibilitychange', onVisibility);
				resolve({ launched: false, failed: true });
			}
		}
	});
}

/**
 * buildSsoAuthorizeDeepLink constructs the `ham://sso-authorize?...` URL
 * that the native HAM App understands. We mirror exactly the query string
 * the third-party web app attached on the original `/sso-authorize` URL so
 * the App can resume the OAuth 2.0 flow unchanged.
 */
export function buildSsoAuthorizeDeepLink(params: {
	appId: string;
	scope: string[];
	state: string;
	redirectUri: string;
}): string {
	const usp = new URLSearchParams();
	usp.set('app_id', params.appId);
	if (params.scope.length > 0) {
		usp.set('scope', params.scope.join(' '));
	}
	if (params.state) {
		usp.set('state', params.state);
	}
	usp.set('redirect_uri', params.redirectUri);
	return `ham://sso-authorize?${usp.toString()}`;
}
