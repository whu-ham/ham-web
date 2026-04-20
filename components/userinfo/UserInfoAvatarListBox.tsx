'use client';

import { useRouter } from 'next/navigation';
import { Label, ListBox } from '@heroui/react';
import { AvatarListLinkType } from '@/components/userinfo/type';
import { useAuth } from '@/services/auth';

/**
 * v3 renames `Listbox` → `ListBox` and requires compound children:
 * `ListBox.Item` with explicit `id` (replaces v2's `key` for state)
 * and a `Label` child so screen readers have a text value even when
 * the visible content contains icons. `onAction` still receives the
 * item's `id` — our `AvatarListLinkType` enum string values continue
 * to work unchanged.
 */
const UserInfoAvatarListBox = () => {
	const router = useRouter();
	const { logout } = useAuth();
	return (
		<div>
			<ListBox
				aria-label='Actions'
				onAction={(key) => {
					if (key === AvatarListLinkType.LOGOUT) {
						logout();
					} else if (key === AvatarListLinkType.HOME) {
						router.push('/');
					}
				}}
			>
				<ListBox.Item id={AvatarListLinkType.HOME} textValue={'返回工具台'}>
					<Label>返回工具台</Label>
				</ListBox.Item>
				<ListBox.Item
					id={AvatarListLinkType.LOGOUT}
					textValue={'退出登录'}
					className={'text-red-500'}
				>
					<Label>退出登录</Label>
				</ListBox.Item>
			</ListBox>
		</div>
	);
};

export default UserInfoAvatarListBox;
