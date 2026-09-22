/**
 * @author Claude
 * @version 1.3
 * @date 2026/9/23 00:41:00
 *
 * Root entry point — there is nothing to show here, so it hands the
 * visitor straight to the console, which owns the auth check.
 */
import { redirect } from 'next/navigation';

const Page = () => redirect('/console');

export default Page;
