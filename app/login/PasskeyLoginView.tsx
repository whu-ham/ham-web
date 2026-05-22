/**
 * Generic Passkey login button for the /login page.
 * Rendering-only — all logic lives in usePasskeyLogin.
 *
 * Renders nothing when the browser does not support WebAuthn / Passkeys.
 */

'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { usePasskeyLogin } from '@/app/login/usePasskeyLogin';

interface PasskeyLoginViewProps {
	onLoginSucceeded?: () => void;
}

const PasskeyLoginView = ({ onLoginSucceeded }: PasskeyLoginViewProps) => {
	const t = useTranslations('sso.passkey');
	const { loading, login, supported } = usePasskeyLogin(onLoginSucceeded);

	if (!supported) return null;

	return (
		<Button variant={'tertiary'} isPending={loading} onPress={login}>
			<span
				className={'material-icons-round text-[18px]! leading-none!'}
				aria-hidden={true}
			>
				key
			</span>
			{t('cta')}
		</Button>
	);
};

export default PasskeyLoginView;
