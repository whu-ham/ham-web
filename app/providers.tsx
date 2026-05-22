'use client';

/**
 * @author orangeboyChen
 * @version 1.3
 * @date 2025/1/24 22:52
 *
 * HeroUI v3 no longer requires a Provider component — the library
 * ships self-contained via React Aria Components, so we only keep
 * the `Toaster` host here.
 *
 * In development, MSW is initialized before the app renders so that
 * mock API handlers are active from the first network request.
 *
 * M1 fix: MSW is only loaded when NEXT_PUBLIC_ENABLE_MSW is explicitly
 * set to 'true'. This prevents the msw package and mock handlers from
 * accidentally being included in production bundles.
 */
import { ReactNode, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

const isMswEnabled = process.env.NEXT_PUBLIC_ENABLE_MSW === 'true';

export const Providers = ({ children }: { children: ReactNode }) => {
	const [mswReady, setMswReady] = useState(!isMswEnabled);

	useEffect(() => {
		if (!isMswEnabled) return;
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
