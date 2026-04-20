/**
 * @author orangeboyChen
 * @version 1.1
 * @date 2025/1/24 22:52
 *
 * HeroUI v3 no longer requires a Provider component — the library
 * ships self-contained via React Aria Components, so we only keep
 * the `Toaster` host here.
 */
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export function Providers({ children }: { children: ReactNode }) {
	return (
		<>
			{children}
			<Toaster />
		</>
	);
}
