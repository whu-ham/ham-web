/**
 * @author Claude
 * @version 1.0
 * @date 2026/4/22 10:38:02
 */
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 * - icon.png, apple-icon.png (Next.js App Router metadata image convention)
		 */
		'/((?!api|_next/static|_next/image|favicon.ico|icon\\.png|apple-icon\\.png|sitemap.xml|robots.txt|\\.well-known).*)',
	],
};

export const proxy = () => {};
