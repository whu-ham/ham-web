/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:30:00
 *
 * Unit tests for the SSO user-agent helpers.
 *
 * The iPad case is the reason this module exists: iPadOS ≥ 13 reports a
 * desktop Safari UA, so a plain `iPad` match misses it and a touch Mac
 * has to be told apart from a real Mac by its touch points. Getting it
 * wrong sends an iPad user to the desktop passkey flow, which cannot
 * complete.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	detectDeviceKind,
	getAppStoreURL,
	isMobile,
	isPasskeySupported,
} from '@/services/sso/ua';

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const IPAD_UA =
	'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
const MAC_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const DESKTOP_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const setTouchPoints = (value: number | undefined) => {
	// `navigator` is stubbed away by one of the tests below, so the guard
	// keeps the teardown from throwing and leaving the stub in place.
	if (typeof navigator === 'undefined') return;
	Object.defineProperty(navigator, 'maxTouchPoints', {
		configurable: true,
		value,
	});
};

describe('detectDeviceKind', () => {
	afterEach(() => {
		// Unstub first: restoring `navigator` is what makes the touch-point
		// reset below possible.
		vi.unstubAllGlobals();
		setTouchPoints(undefined);
	});

	it('detects iPhone, iPad and iPod', () => {
		expect(detectDeviceKind(IPHONE_UA)).toBe('ios');
		expect(detectDeviceKind(IPAD_UA)).toBe('ios');
		expect(detectDeviceKind('Mozilla/5.0 (iPod touch)')).toBe('ios');
	});

	// iPadOS ≥ 13 pretends to be a Mac, so touch is the only remaining
	// signal. A MacBook has no multi-touch screen, an iPad does.
	it('detects an iPad that reports as Macintosh with touch', () => {
		setTouchPoints(5);

		expect(detectDeviceKind(MAC_UA)).toBe('ios');
	});

	it('keeps a Macintosh with a single touch point on desktop', () => {
		setTouchPoints(1);

		expect(detectDeviceKind(MAC_UA)).toBe('desktop');
	});

	// A runtime without `maxTouchPoints` (or with no navigator at all)
	// must not read the property unguarded.
	it('keeps a Macintosh on desktop when touch points are unknown', () => {
		setTouchPoints(undefined);

		expect(detectDeviceKind(MAC_UA)).toBe('desktop');
	});

	it('keeps a Macintosh on desktop when there is no navigator', () => {
		vi.stubGlobal('navigator', undefined);

		expect(detectDeviceKind(MAC_UA)).toBe('desktop');
	});

	it('detects android', () => {
		setTouchPoints(0);

		expect(detectDeviceKind(ANDROID_UA)).toBe('android');
	});

	it('falls back to desktop', () => {
		expect(detectDeviceKind(DESKTOP_UA)).toBe('desktop');
		expect(detectDeviceKind('')).toBe('desktop');
	});
});

describe('isMobile', () => {
	afterEach(() => {
		setTouchPoints(undefined);
	});

	it('is true for iOS and Android', () => {
		expect(isMobile(IPHONE_UA)).toBe(true);
		expect(isMobile(ANDROID_UA)).toBe(true);
	});

	it('is false for desktop', () => {
		expect(isMobile(DESKTOP_UA)).toBe(false);
	});
});

describe('getAppStoreURL', () => {
	it('points iOS at the App Store listing', () => {
		expect(getAppStoreURL('ios')).toBe(
			'https://apps.apple.com/cn/app/ham/id1577896044'
		);
	});

	// Android and desktop share the download page, which is why the
	// switch has no `android` case.
	it('points every other platform at the download page', () => {
		expect(getAppStoreURL('android')).toBe(
			'https://whu-ham.github.io/download/'
		);
		expect(getAppStoreURL('desktop')).toBe(
			'https://whu-ham.github.io/download/'
		);
	});
});

describe('isPasskeySupported', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const setCredentials = (value: unknown) => {
		Object.defineProperty(navigator, 'credentials', {
			configurable: true,
			value,
		});
	};

	// Server-side renders have no window; the check must stay silent
	// instead of throwing and failing the whole page.
	it('is false without a window', () => {
		vi.stubGlobal('window', undefined);

		expect(isPasskeySupported()).toBe(false);
	});

	it('is false when the browser has no PublicKeyCredential', () => {
		vi.stubGlobal('PublicKeyCredential', undefined);
		setCredentials({});

		expect(isPasskeySupported()).toBe(false);
	});

	it('is false when there is no navigator', () => {
		vi.stubGlobal('PublicKeyCredential', class {});
		vi.stubGlobal('navigator', undefined);

		expect(isPasskeySupported()).toBe(false);
	});

	it('is false when the credentials API is missing', () => {
		vi.stubGlobal('PublicKeyCredential', class {});
		setCredentials(undefined);

		expect(isPasskeySupported()).toBe(false);
	});

	it('is true when the browser exposes both APIs', () => {
		vi.stubGlobal('PublicKeyCredential', class {});
		setCredentials({});

		expect(isPasskeySupported()).toBe(true);
	});
});
