/**
 * @author Claude
 * @version 1.2
 * @date 2026/9/23 00:58:40
 *
 * Custom hook for the create token modal.
 * Handles scope selection (with parent/child checkbox logic),
 * validation, and submission.
 *
 * The TTL range check rejects non-finite values. Clearing the
 * field leaves NaN, and every comparison against NaN is false, so the
 * range check waved through a value that serialises to `null`.
 */

'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import {
	createModalVisibleAtom,
	newlyCreatedTokenAtom,
	tokenListVersionAtom,
} from '@/app/console/tokens/store';
import { ApiError, TokenApi, VALID_SCOPES } from '@/services/token/api';

const PARENT_SCOPE = 'mcp';
const CHILD_SCOPES: readonly string[] = ['mcp:read', 'mcp:write'];

export interface UseCreateTokenReturn {
	visible: boolean;
	name: string;
	setName: (name: string) => void;
	scopes: string[];
	ttl: number;
	setTtl: (ttl: number) => void;
	submitting: boolean;
	isParentChecked: boolean;
	isParentIndeterminate: boolean;
	handleScopeChange: (scope: string, checked: boolean) => void;
	handleClose: () => void;
	handleSubmit: () => Promise<void>;
}

export const useCreateToken = (): UseCreateTokenReturn => {
	const t = useTranslations('apikey');
	const [visible, setVisible] = useAtom(createModalVisibleAtom);
	const setNewlyCreated = useSetAtom(newlyCreatedTokenAtom);
	const bumpVersion = useSetAtom(tokenListVersionAtom);
	const [name, setName] = useState('');
	const [scopes, setScopes] = useState<string[]>([]);
	const [ttl, setTtl] = useState(30);
	const [submitting, setSubmitting] = useState(false);
	const submittingRef = useRef(false);
	const cancelledRef = useRef(false);

	// s5: Clean up on unmount
	useEffect(() => {
		// Reset on every mount: Strict Mode mounts, unmounts and mounts
		// again, and an instance that inherits the "unmounted" flag would
		// never clear its submitting state after a create.
		cancelledRef.current = false;
		return () => {
			cancelledRef.current = true;
		};
	}, []);

	const isParentChecked = scopes.includes(PARENT_SCOPE);

	const isParentIndeterminate = useMemo(() => {
		const checkedChildren = CHILD_SCOPES.filter((c) => scopes.includes(c));
		return (
			checkedChildren.length > 0 && checkedChildren.length < CHILD_SCOPES.length
		);
	}, [scopes]);

	const handleScopeChange = useCallback((scope: string, checked: boolean) => {
		setScopes((prev) => {
			if (scope === PARENT_SCOPE) {
				if (checked) {
					return [...new Set([PARENT_SCOPE, ...CHILD_SCOPES, ...prev])];
				}
				return prev.filter(
					(s) => s !== PARENT_SCOPE && !CHILD_SCOPES.includes(s)
				);
			}
			let next = checked ? [...prev, scope] : prev.filter((s) => s !== scope);
			if (!checked) {
				next = next.filter((s) => s !== PARENT_SCOPE);
			}
			if (CHILD_SCOPES.every((c) => next.includes(c))) {
				if (!next.includes(PARENT_SCOPE)) {
					next.push(PARENT_SCOPE);
				}
			}
			return next;
		});
	}, []);

	const normalizedScopes = useMemo(() => {
		if (scopes.includes(PARENT_SCOPE)) {
			return [PARENT_SCOPE];
		}
		return scopes;
	}, [scopes]);

	const handleClose = useCallback(() => {
		setVisible(false);
		setName('');
		setScopes([]);
		setTtl(30);
	}, [setVisible]);

	const handleSubmit = useCallback(async () => {
		if (submittingRef.current) return; // M8: Prevent double submit
		if (!name.trim()) {
			toast.error(t('validation.nameRequired'));
			return;
		}
		if (name.length > 128) {
			toast.error(t('validation.nameTooLong'));
			return;
		}
		if (scopes.length === 0) {
			toast.error(t('validation.scopesRequired'));
			return;
		}
		// NaN fails every comparison, so an emptied field used to sail
		// through this check and serialise to `null` in the request body.
		if (!Number.isFinite(ttl) || ttl < 1 || ttl > 30) {
			toast.error(t('validation.ttlRange'));
			return;
		}

		submittingRef.current = true;
		setSubmitting(true);
		try {
			const resp = await TokenApi.create({
				name: name.trim(),
				scopes: normalizedScopes as (typeof VALID_SCOPES)[number][],
				ttl_days: ttl,
			});
			if (cancelledRef.current) return;
			setNewlyCreated(resp);
			bumpVersion((v) => v + 1);
			toast.success(t('createModal.success'));
			handleClose();
		} catch (e) {
			if (cancelledRef.current) return;
			if (e instanceof ApiError) {
				if (e.code === '12002' || e.status === 403) {
					toast.error(t('validation.tokenLimit'));
				} else {
					toast.error(e.message || t('error.createFailed'));
				}
			} else {
				toast.error(t('error.createFailed'));
			}
		} finally {
			if (!cancelledRef.current) {
				submittingRef.current = false;
				setSubmitting(false);
			}
		}
	}, [
		name,
		scopes,
		normalizedScopes,
		ttl,
		t,
		setNewlyCreated,
		handleClose,
		bumpVersion,
	]);

	return {
		visible,
		name,
		setName,
		scopes,
		ttl,
		setTtl,
		submitting,
		isParentChecked,
		isParentIndeterminate,
		handleScopeChange,
		handleClose,
		handleSubmit,
	};
};

export { PARENT_SCOPE, CHILD_SCOPES };
