/**
 * @author Claude
 * @version 2.0
 * @date 2026/5/22
 *
 * Shared logout hook. Logs out via WebAuthApi and redirects to /.
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { WebAuthApi } from '@/services/sso/api';

export const useLogout = () => {
	const router = useRouter();

	return useCallback(async () => {
		try {
			await WebAuthApi.logout();
		} finally {
			router.push('/');
		}
	}, [router]);
};
