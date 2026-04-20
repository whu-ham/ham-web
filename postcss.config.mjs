/** @type {import('postcss-load-config').Config} */
const config = {
	plugins: {
		// Tailwind CSS v4 ships its PostCSS plugin as a separate package.
		'@tailwindcss/postcss': {},
	},
};

export default config;
