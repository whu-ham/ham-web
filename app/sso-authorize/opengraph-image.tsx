/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/21 15:26:00
 *
 * Generates the Open Graph / iMessage link-preview image for the
 * SSO authorize page via Next.js ImageResponse (next/og).
 * Rendered at build-time (static) — no runtime cost.
 */
import { ImageResponse } from 'next/og';

export const alt = 'Authorize Ham';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
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
				{/* App icon circle */}
				<div
					style={{
						width: 120,
						height: 120,
						borderRadius: 28,
						background: 'linear-gradient(145deg, #6366f1 0%, #8b5cf6 100%)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						marginBottom: 32,
						boxShadow: '0 20px 60px rgba(99,102,241,0.4)',
					}}
				>
					<span
						style={{
							fontSize: 64,
							color: '#ffffff',
							fontWeight: 700,
							letterSpacing: -2,
						}}
					>
						H
					</span>
				</div>

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
