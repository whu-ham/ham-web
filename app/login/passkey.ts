'use client';

/**
 * @author orangeboyChen
 * @version 1.0
 * @date 2025/1/28 00:24
 */
import { JsPasskeyService } from '@/wasm/pkg';
import useRequest from '@/hooks/useRequest';

const usePasskey = () => {
	const { request } = useRequest();
	const getPasskeyCredentials = async () => {
		const options = await request({
			call: () => JsPasskeyService.get_credentials_request_options(),
		});
		options.publicKey.challenge = Buffer.from(
			options.publicKey.challenge,
			'base64'
		);
		return await navigator.credentials.get(options);
	};
	return { getPasskeyCredentials };
};

export default usePasskey;

export class getPasskeyCredentials {}
