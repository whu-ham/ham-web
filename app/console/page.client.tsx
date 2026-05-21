/**
 * @author Claude
 * @version 1.0
 * @date 2026/5/21
 *
 * Client-side orchestrator for /console.
 *
 * Flow:
 *   1. On mount, call WebAuthApi.me() to check session.
 *   2. 401 → show login view (reuses generic LoginView component).
 *   3. Authenticated → show ConsoleView with user info + feature cards.
 */
'use client';

import { useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

import ConsoleView from '@/app/console/ConsoleView';
import { consoleStageAtom } from '@/app/console/store';
import LoginView from '@/components/LoginView';
import PageFrame from '@/components/PageFrame';
import { ApiError, WebAuthApi } from '@/services/sso/api';

const ConsolePage = () => {
	const [stage, setStage] = useAtom(consoleStageAtom);

	const probeLogin = useCallback(async () => {
		try {
			const me = await WebAuthApi.me();
			setStage({ kind: 'console', me });
		} catch (e) {
			if (e instanceof ApiError && e.status === 401) {
				setStage({ kind: 'login' });
				return;
			}
			// Other errors — treat as not-logged-in
			setStage({ kind: 'login' });
		}
	}, [setStage]);

	useEffect(() => {
		probeLogin();
	}, [probeLogin]);

	if (stage.kind === 'loading') {
		return <div className={'min-h-screen'} />;
	}

	if (stage.kind === 'login') {
		return (
			<PageFrame>
				<LoginView
					onLoggedIn={(me) => setStage({ kind: 'console', me })}
					onLoginFailed={() => setStage({ kind: 'login' })}
					namespace="console"
				/>
			</PageFrame>
		);
	}

	// stage.kind === 'console'
	return (
		<PageFrame maxWidth="max-w-2xl">
			<ConsoleView me={stage.me} onLogout={() => setStage({ kind: 'login' })} />
		</PageFrame>
	);
};

export default ConsolePage;
