/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 00:41:00
 *
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
