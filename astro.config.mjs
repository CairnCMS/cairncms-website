// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://cairncms.dev',
	integrations: [
		starlight({
			title: 'CairnCMS',
			disable404Route: true,
			sidebar: [
				{ label: 'Getting started', autogenerate: { directory: 'docs/getting-started' } },
				{ label: 'Reference', autogenerate: { directory: 'docs/reference' } },
			],
		}),
	],
	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					silenceDeprecations: ['color-functions', 'global-builtin', 'if-function', 'import'],
				},
			},
		},
	},
});
