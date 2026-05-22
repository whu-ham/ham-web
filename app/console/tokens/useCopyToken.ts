/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/22
 *
 * Custom hook for copying a token to the clipboard.
 * Falls back to execCommand for older browsers.
 */

'use client';

import { useCallback, useState } from 'react';

export const useCopyToken = (token: string | undefined) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		if (!token || copied) return;
		try {
			await navigator.clipboard.writeText(token);
			setCopied(true);
		} catch {
			try {
				const textarea = document.createElement('textarea');
				textarea.value = token;
				textarea.style.position = 'fixed';
				textarea.style.opacity = '0';
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
				setCopied(true);
			} catch {
				// execCommand fallback also failed — ignore
			}
		}
	}, [token, copied]);

	const reset = useCallback(() => {
		setCopied(false);
	}, []);

	return { copied, handleCopy, reset };
};
