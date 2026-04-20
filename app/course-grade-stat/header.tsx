import { UserInfoAvatar } from '@/components/userinfo/UserInfoAvatar';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/26 01:18
 */
const Header = () => {
	return (
		<div
			className={
				'flex flex-row-reverse items-center w-full ' +
				'px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 2xl:px-48'
			}
		>
			<UserInfoAvatar />
		</div>
	);
};

export default Header;
