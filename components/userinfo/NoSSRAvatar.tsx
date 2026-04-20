'use client';

import { useUserInfo } from '@/hooks/useUserInfo';
import { Avatar } from '@heroui/react';
import dynamic from 'next/dynamic';

/**
 * HeroUI v3 removed the `name` and `src` shorthand in favour of
 * an explicit `Avatar.Image` + `Avatar.Fallback` compound. The image
 * still wins when it loads; the fallback only shows when the URL is
 * missing or fails. That matches what v2's `name` + `showFallback`
 * combination gave us, minus the manual initials — we drop them
 * entirely here because our fallback slot is an icon, not initials.
 */
const NoSSRAvatar = ({ className = '' }: { className: string }) => {
	const [userInfo] = useUserInfo();
	return (
		<Avatar suppressHydrationWarning className={className}>
			{userInfo?.avatarUrl ? (
				<Avatar.Image src={userInfo.avatarUrl} alt={userInfo.nickname ?? ''} />
			) : null}
			<Avatar.Fallback>
				<span
					className={'material-icons-round !text-[18px] text-gray-500'}
					aria-hidden={true}
				>
					person
				</span>
			</Avatar.Fallback>
		</Avatar>
	);
};

export default dynamic(() => Promise.resolve(NoSSRAvatar), { ssr: false });
