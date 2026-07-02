import { FROM_COOKIE, STATE_COOKIE } from '@/services/cookies';

const LOGIN_COOKIE_MAX_AGE = 60 * 10;

export interface LoginCookieWriter {
	set(
		name: string,
		value: string,
		options: {
			httpOnly: boolean;
			secure: boolean;
			sameSite: 'lax';
			path: string;
			maxAge: number;
		}
	): unknown;
}

export interface LoginCookieRead {
	get(name: string): { value: string } | undefined;
	delete(name: string): unknown;
}

export const createLoginState = (): string => crypto.randomUUID();

export const setLoginCookies = (
	cookies: LoginCookieWriter,
	from: string
): string => {
	const state = createLoginState();

	cookies.set(STATE_COOKIE, state, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	cookies.set(FROM_COOKIE, from, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: LOGIN_COOKIE_MAX_AGE,
	});

	return state;
};

export const clearLoginCookies = (cookies: LoginCookieRead) => {
	cookies.delete(STATE_COOKIE);
	cookies.delete(FROM_COOKIE);
};

export const LOGIN_FLOW_COOKIE_NAMES = {
	state: STATE_COOKIE,
	from: FROM_COOKIE,
} as const;
