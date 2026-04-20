import { Popover } from '@heroui/react';
import UserInfoAvatarListBox from '@/components/userinfo/UserInfoAvatarListBox';
import NoSSRAvatar from '@/components/userinfo/NoSSRAvatar';

/**
 * v3 Popover moved `placement` from the root to `Popover.Content` and
 * requires content to be wrapped in `Popover.Dialog`. We keep the
 * avatar as the trigger child (v3 accepts any child as the trigger
 * when no explicit `Popover.Trigger` is given, but we keep the wrapper
 * here so the click target matches the visible area exactly).
 */
const UserInfoAvatar = () => {
	return (
		<Popover>
			<Popover.Trigger>
				<div className={'size-[40px]'}>
					<NoSSRAvatar
						className={
							'cursor-pointer hover:opacity-80 active:opacity-disabled transition-opacity'
						}
					/>
				</div>
			</Popover.Trigger>
			<Popover.Content placement={'bottom'}>
				<Popover.Dialog>
					<UserInfoAvatarListBox />
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
};

export { UserInfoAvatar };
