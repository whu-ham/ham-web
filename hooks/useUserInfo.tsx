import { useLocalStorage } from 'react-use';
import { Dispatch, SetStateAction } from 'react';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/2/5 12:50
 */
interface UserInfo {
	avatarUrl: string;
	nickname: string;
}

const useUserInfo = (): [
	UserInfo | undefined,
	Dispatch<SetStateAction<UserInfo | undefined>>,
	() => void,
] => {
	'use client';
	return useLocalStorage<UserInfo>('userInfo');
};

export { useUserInfo };
