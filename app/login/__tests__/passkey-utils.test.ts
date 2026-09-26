/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 20:25:31
 *
 * Unit tests for the pure WebAuthn encoding helpers.
 *
 * WebAuthn speaks base64url and ArrayBuffer; the browser API returns the
 * latter and the backend expects the former. A padding mistake or a
 * missing `-`/`_` substitution does not throw — the server simply
 * rejects the assertion — so the conversion is pinned byte for byte in
 * both directions, including the three padding cases.
 */
import { describe, expect, it } from 'vitest';

import {
	arrayBufferToBase64URL,
	base64ToArrayBuffer,
	credentialToJSON,
} from '@/app/login/passkey-utils';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

const bytesOf = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf));

describe('base64ToArrayBuffer', () => {
	it('decodes a base64url string that needs no padding', () => {
		expect(bytesOf(base64ToArrayBuffer('AQID'))).toEqual([1, 2, 3]);
	});

	it('pads a string two characters short', () => {
		expect(bytesOf(base64ToArrayBuffer('AQI'))).toEqual([1, 2]);
	});

	it('pads a string one character short', () => {
		expect(bytesOf(base64ToArrayBuffer('ABCD'))).toEqual([0, 16, 131]);
	});

	it('translates the base64url alphabet back to base64', () => {
		// '-' and '_' are the only two characters that differ between the
		// alphabets; a missed substitution corrupts the signature.
		expect(bytesOf(base64ToArrayBuffer('-v--'))).toEqual([250, 255, 190]);
	});

	it('leaves an already padded string alone', () => {
		expect(bytesOf(base64ToArrayBuffer('SGVsbG8sIEhhbSE='))).toEqual(
			bytesOf(base64ToArrayBuffer('SGVsbG8sIEhhbSE'))
		);
	});
});

describe('arrayBufferToBase64URL', () => {
	it('encodes without padding', () => {
		expect(arrayBufferToBase64URL(bytes(1, 2, 3, 4))).toBe('AQIDBA');
	});

	it('substitutes the base64url alphabet', () => {
		expect(arrayBufferToBase64URL(bytes(250, 255, 190))).toBe('-v--');
	});

	it('round-trips a credential id', () => {
		const encoded = arrayBufferToBase64URL(bytes(72, 101, 108, 108, 111));

		expect(bytesOf(base64ToArrayBuffer(encoded))).toEqual([
			72, 101, 108, 108, 111,
		]);
	});

	it('encodes an empty buffer as an empty string', () => {
		expect(arrayBufferToBase64URL(new ArrayBuffer(0))).toBe('');
	});
});

describe('credentialToJSON', () => {
	const credential = (userHandle: ArrayBuffer | null) =>
		({
			id: 'cred-1',
			type: 'public-key',
			rawId: bytes(1, 2, 3),
			response: {
				authenticatorData: bytes(4, 5),
				clientDataJSON: bytes(6, 7),
				signature: bytes(250, 255, 190),
				userHandle,
			},
			getClientExtensionResults: () => ({ appid: true }),
		}) as unknown as PublicKeyCredential;

	it('encodes every assertion field as base64url', () => {
		const json = credentialToJSON(credential(null));

		expect(json).toEqual({
			id: 'cred-1',
			rawId: 'AQID',
			type: 'public-key',
			response: {
				authenticatorData: 'BAU',
				clientDataJSON: 'Bgc',
				signature: '-v--',
				userHandle: null,
			},
			clientExtensionResults: { appid: true },
		});
	});

	it('encodes a user handle when the authenticator returns one', () => {
		const json = credentialToJSON(credential(bytes(72, 105)));

		expect(json.response.userHandle).toBe('SGk');
	});
});
