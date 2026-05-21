'use client';

/**
 * @author orangeboyChen
 * @version 1.2
 * @date 2025/1/24 22:52
 *
 * HeroUI v3 no longer requires a Provider component — the library
 * ships self-contained via React Aria Components, so we only keep
 * the `Toaster` host here.
 *
 * In development, MSW is initialized before the app renders so that
 * mock API handlers are active from the first network request.
 */
import { ReactNode, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

const isDev = process.env.NODE_ENV === 'development';

export const Providers = ({ children }: { children: ReactNode }) => {
	const [mswReady, setMswReady] = useState(!isDev);

	useEffect(() => {
		if (!isDev) return;
		import('@/mocks/browser').then(({ worker }) => {
			worker.start({ onUnhandledRequest: 'bypass' }).then(() => {
				setMswReady(true);
			});
		});
	}, []);

	if (!mswReady) {
		return null;
	}

	return (
		<>
			{children}
			<Toaster />
		</>
	);
};
