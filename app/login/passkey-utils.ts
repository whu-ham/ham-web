/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Pure WebAuthn encoding utilities for Passkey authentication.
 * Extracted from PasskeyLoginView for testability and reuse.
 */

export const base64ToArrayBuffer = (value: string): ArrayBuffer => {
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(
		normalized.length + ((4 - (normalized.length % 4)) % 4),
		'='
	);
	const raw = atob(padded);
	const buf = new ArrayBuffer(raw.length);
	const view = new Uint8Array(buf);
	for (let i = 0; i < raw.length; i++) {
		view[i] = raw.charCodeAt(i);
	}
	return buf;
};

export const arrayBufferToBase64URL = (buf: ArrayBuffer): string => {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
};

export const credentialToJSON = (credential: PublicKeyCredential) => {
	const response = credential.response as AuthenticatorAssertionResponse;
	return {
		id: credential.id,
		rawId: arrayBufferToBase64URL(credential.rawId),
		type: credential.type,
		response: {
			authenticatorData: arrayBufferToBase64URL(response.authenticatorData),
			clientDataJSON: arrayBufferToBase64URL(response.clientDataJSON),
			signature: arrayBufferToBase64URL(response.signature),
			userHandle: response.userHandle
				? arrayBufferToBase64URL(response.userHandle)
				: null,
		},
		clientExtensionResults: credential.getClientExtensionResults(),
	};
};
