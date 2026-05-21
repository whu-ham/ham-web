/**
 * Next.js App Router template — wraps children in PageTransition
 * which uses key={pathname} to force re-mount and replay the
 * fade-in animation on every navigation.
 */
import { PageTransition } from '@/components/PageTransition';

export default function Template({ children }: { children: React.ReactNode }) {
	return <PageTransition>{children}</PageTransition>;
}
