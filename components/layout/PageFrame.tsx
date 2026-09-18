/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/18 19:17:29
 *
 * Shared page frame component providing a full-screen centered layout
 * with HeaderBar (theme + language switchers) and a rounded Card container.
 * Extracted from app/sso-authorize/page.client.tsx for reuse across
 * sso-authorize, console, and tokens pages.
 */
'use client';

import HeaderBar from '@/components/layout/HeaderBar';

interface PageFrameProps {
	children: React.ReactNode;
	/** Card maximum width class, default 'max-w-md' */
	maxWidth?: string;
	/** Additional class names for the outer wrapper */
	className?: string;
}

const PageFrame = ({
	children,
	maxWidth = 'max-w-md',
	className,
}: PageFrameProps) => (
	<div
		className={
			'min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-center bg-default px-5 sm:px-6 md:px-8 py-20 ' +
			(className ?? '')
		}
	>
		<HeaderBar />
		<div
			className={
				'bg-surface rounded-[16px] p-6 md:p-10 w-full ' +
				maxWidth +
				' flex flex-col items-stretch gap-6'
			}
		>
			{children}
		</div>
	</div>
);

export default PageFrame;
