/**
 * @author Claude
 * @version 2.4
 * @date 2026/4/23 12:43:04
 *
 * Generates the Open Graph / iMessage link-preview image for the
 * SSO authorize page via Next.js ImageResponse (next/og).
 *
 * The icon is inlined as a base64 data URL (see og-icon-b64.ts),
 * generated at build-prep time from public/icon-1024.png.
 * No filesystem or network access at request time — fully compatible
 * with the Cloudflare Workers Edge runtime (@opennextjs/cloudflare).
 *
 * Layout: icon on the left, title + description on the right,
 * both vertically centred. Text is left-aligned.
 */
import { ImageResponse } from 'next/og';
import { ICON_DATA_URL } from './og-icon-b64';

export const dynamic = 'force-static';
export const alt = 'Authorize Ham';
export const size = { width: 1200, height: 680 };
export const contentType = 'image/png';

const title = 'Authorize Ham';
const description = 'Sign in to Ham to authorize third-party apps.';

export default async function OgImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: '100%',
					height: '100%',
					display: 'flex',
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'linear-gradient(135deg, #f5f5f7 0%, #e8eaf6 100%)',
					fontFamily:
						'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					padding: '0 80px',
					gap: 48,
				}}
			>
				{/* App icon */}
				<img
					src={ICON_DATA_URL}
					width={180}
					height={180}
					style={{
						borderRadius: 40,
						flexShrink: 0,
						boxShadow: '0 20px 60px rgba(99,102,241,0.4)',
					}}
				/>

				{/* Text block */}
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-start',
						justifyContent: 'center',
						gap: 12,
					}}
				>
					{/* Title */}
					<div
						style={{
							fontSize: 72,
							fontWeight: 700,
							color: '#1a1a2e',
							letterSpacing: -1,
							lineHeight: 1.1,
						}}
					>
						{title}
					</div>

					{/* Description */}
					<div
						style={{
							fontSize: 36,
							color: 'rgba(26,26,46,0.5)',
							letterSpacing: 0,
							lineHeight: 1.4,
						}}
					>
						{description}
					</div>
				</div>
			</div>
		),
		{ ...size }
	);
}
