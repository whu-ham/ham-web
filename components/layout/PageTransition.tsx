/**
 * Page transition wrapper — forces re-mount on route change
 * so the CSS fade-in animation replays for every navigation.
 */
'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export const PageTransition = ({ children }: { children: ReactNode }) => {
	const pathname = usePathname();
	return (
		<div key={pathname} className={'page-animate-in'}>
			{children}
		</div>
	);
};
