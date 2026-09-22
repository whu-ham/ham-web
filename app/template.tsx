/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 00:41:00
 *
 * Next.js App Router template — wraps children in PageTransition
 * which uses key={pathname} to force re-mount and replay the
 * fade-in animation on every navigation.
 */
import { PageTransition } from '@/components/layout/PageTransition';

export default function Template({ children }: { children: React.ReactNode }) {
	return <PageTransition>{children}</PageTransition>;
}
