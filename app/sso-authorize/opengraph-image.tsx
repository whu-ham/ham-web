/**
 * @author Claude
 * @version 1.4
 * @date 2026/4/22 14:58:10
 *
 * Generates the Open Graph / iMessage link-preview image for the
 * SSO authorize page via Next.js ImageResponse (next/og).
 */
import { headers } from 'next/headers';
import { ImageResponse } from 'next/og';

export const alt = 'Authorize Ham';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage() {
	const headersList = await headers();
	const host = headersList.get('host') ?? 'ham.nowcent.cn';
	const proto = host.startsWith('localhost') ? 'http' : 'https';
	const baseUrl = `${proto}://${host}`;
	const iconData = await fetch(`${baseUrl}/icon-1024.png`).then((r) =>
		r.arrayBuffer()
	);

	return new ImageResponse(
		(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
					fontFamily:
						'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
				}}
			>
				{/* App icon */}
				<img
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					src={iconData as any}
					width={120}
					height={120}
					style={{
						borderRadius: 28,
						marginBottom: 32,
						boxShadow: '0 20px 60px rgba(99,102,241,0.4)',
					}}
				/>

				{/* Title */}
				<div
					style={{
						fontSize: 52,
						fontWeight: 700,
						color: '#ffffff',
						letterSpacing: -1,
						marginBottom: 16,
					}}
				>
					Authorize Ham
				</div>

				{/* Subtitle */}
				<div
					style={{
						fontSize: 26,
						color: 'rgba(255,255,255,0.55)',
						letterSpacing: 0,
					}}
				>
					Sign in to continue
				</div>
			</div>
		),
		{ ...size }
	);
}
