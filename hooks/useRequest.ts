'use client';

import { JsRequestError } from '@/wasm/pkg';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/2/5 15:30
 */

/**
 * 错误码
 */
enum GrpcResponseCode {
	PERMISSION_DENIED = 7,
	UNAUTHENTICATED = 16,
}

const useRequest = () => {
	const router = useRouter();
	const request = useCallback(
		async <T>({ call }: { call: () => Promise<T> }) => {
			try {
				return await call();
			} catch (e) {
				if (e instanceof JsRequestError) {
					const code = e.code;
					if (code in GrpcResponseCode) {
						localStorage.removeItem('userInfo');
						router.push('/login');
					}
					const message = e.message;
					toast.error(message);
					throw new Error(message);
				} else if (typeof e === 'string') {
					toast.error(e);
				}
				throw e;
			}
		},
		[router]
	);
	return { request };
};

export default useRequest;
