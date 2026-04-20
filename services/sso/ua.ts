/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/20
 *
 * Small UA helpers for the SSO authorize page. We keep them in a dedicated
 * module so they can be unit-tested in isolation and swapped for mocked
 * navigator values during jest runs.
 */
'use client';

export type DeviceKind = 'ios' | 'android' | 'desktop';

export function detectDeviceKind(userAgent: string): DeviceKind {
	const ua = userAgent.toLowerCase();
	if (/iphone|ipad|ipod/.test(ua)) {
		return 'ios';
	}
	// iPadOS ≥ 13 reports as desktop Safari unless we sniff touch + Mac.
	if (/macintosh/.test(ua) && typeof navigator !== 'undefined') {
		const maxTouchPoints =
			(navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ??
			0;
		if (maxTouchPoints > 1) {
			return 'ios';
		}
	}
	if (/android/.test(ua)) {
		return 'android';
	}
	return 'desktop';
}

export function isMobile(userAgent: string): boolean {
	const kind = detectDeviceKind(userAgent);
	return kind === 'ios' || kind === 'android';
}

/**
 * Best effort "App download" URL per platform. The real store URLs should
 * live in env-based configuration in the long run, but hard-coding the
 * product-approved defaults keeps the fallback page self-contained until
 * that config pipeline lands.
 */
export function getAppStoreURL(kind: DeviceKind): string | undefined {
	switch (kind) {
		case 'ios':
			return 'https://apps.apple.com/app/ham/id0000000000';
		case 'android':
			return 'https://ham.nowcent.cn/download/ham-android.apk';
		default:
			return undefined;
	}
}

/**
 * Quick feature-detect for WebAuthn / Passkey support. Keeps the check
 * identical between the Passkey tab and the mobile fallback screen so
 * we don't dangle a "Use Passkey" button on browsers that can't honor
 * it.
 */
export function isPasskeySupported(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		typeof window.PublicKeyCredential !== 'undefined' &&
		typeof navigator !== 'undefined' &&
		typeof navigator.credentials !== 'undefined'
	);
}
