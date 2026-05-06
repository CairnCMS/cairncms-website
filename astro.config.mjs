// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://cairncms.dev',
	integrations: [
		sitemap(),
		starlight({
			title: 'CairnCMS',
			disable404Route: true,
			favicon: '/logo/logo-flat-solid.svg',
			logo: {
				src: './public/logo/logo-flat-solid.svg',
				alt: 'CairnCMS logo: a stack of stones forming a cairn',
			},
			customCss: [
				'@fontsource/ibm-plex-sans/400.css',
				'@fontsource/ibm-plex-sans/500.css',
				'@fontsource/ibm-plex-sans/600.css',
				'./src/styles/starlight-overrides.css',
			],
			head: [
				{
					tag: 'script',
					attrs: {
						defer: true,
						src: 'https://cloud.umami.is/script.js',
						'data-website-id': 'dcd90c8d-1b3b-4445-bfd5-1d7f0703dc88',
					},
				},
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: 'https://cairncms.dev/og.png' },
				},
				{
					tag: 'meta',
					attrs: { property: 'og:site_name', content: 'CairnCMS' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:card', content: 'summary_large_image' },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image', content: 'https://cairncms.dev/og.png' },
				},
			],
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
