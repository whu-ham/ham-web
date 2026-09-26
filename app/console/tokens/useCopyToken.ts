/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/26 12:28:00
 *
 * Custom hook for copying a token to the clipboard.
 * Falls back to execCommand for older browsers.
 *
 * m3 fix: Shows a toast when both clipboard API and fallback fail,
 * instead of silently ignoring the error.
 *
 * The scratch textarea is removed in a `finally`: `execCommand` throws on
 * browsers that no longer implement it, which used to abandon an
 * off-screen node in the document on every failed copy.
 */
'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

export const useCopyToken = (token: string | undefined) => {
	const t = useTranslations('apikey');
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
				try {
					document.body.appendChild(textarea);
					textarea.select();
					document.execCommand('copy');
					setCopied(true);
				} finally {
					textarea.remove();
				}
			} catch {
				// m3: Show feedback when both methods fail
				toast.error(t('tokenReveal.copyFailed'));
			}
		}
	}, [token, copied, t]);

	const reset = useCallback(() => {
		setCopied(false);
	}, []);

	return { copied, handleCopy, reset };
};
