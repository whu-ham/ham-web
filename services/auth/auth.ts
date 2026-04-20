import { useUserInfo } from '@/hooks/useUserInfo';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/2/8 01:24
 */
const useAuth = () => {
	'use client';
	const [, setUserInfo] = useUserInfo();
	const router = useRouter();
	const logout = () => {
		const func = async () => {
			setUserInfo(undefined);
			Cookies.remove('token');
			router.push('/login');
			toast.success('已退出登录');
		};
		func().then(() => {});
	};

	return {
		logout,
	};
};

export default useAuth;
