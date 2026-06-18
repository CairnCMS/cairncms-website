// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightPageActions from 'starlight-page-actions';
import starlightThemeRapide from 'starlight-theme-rapide';

export default defineConfig({
	site: 'https://cairncms.dev',
	integrations: [
		sitemap(),
		starlight({
			title: 'CairnCMS',
			disable404Route: true,
			favicon: '/logo/logo-flat-solid.svg',
			plugins: [starlightPageActions(),starlightThemeRapide()],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/CairnCMS/cairncms' },
			],
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
						'data-domains': 'cairncms.dev',
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
				{
					label: 'Guides',
					collapsed: true,
					items: [
						{ slug: 'docs/guides' },
						{ slug: 'docs/guides/auth' },
						{ slug: 'docs/guides/files' },
						{ slug: 'docs/guides/insights' },
						{ slug: 'docs/guides/permissions' },
						{ slug: 'docs/guides/settings' },
						{ slug: 'docs/guides/users' },
						{ label: 'Content Module', collapsed: true, autogenerate: { directory: 'docs/guides/content' } },
						{ label: 'Data Model', collapsed: true, autogenerate: { directory: 'docs/guides/data-model' } },
						{ label: 'Flows', collapsed: true, autogenerate: { directory: 'docs/guides/flows' } },
					],
				},
				{
					label: 'Develop',
					collapsed: true,
					items: [
						{ slug: 'docs/develop' },
						{ slug: 'docs/develop/clients' },
						{ slug: 'docs/develop/custom-migrations' },
						{ slug: 'docs/develop/email-templates' },
						{
							label: 'Extensions',
							collapsed: true,
							items: [
								{ slug: 'docs/develop/extensions' },
								{ slug: 'docs/develop/extensions/creating-extensions' },
								{
									label: 'App extensions',
									collapsed: true,
									autogenerate: { directory: 'docs/develop/extensions/app-extensions' },
								},
								{
									label: 'Server extensions',
									collapsed: true,
									autogenerate: { directory: 'docs/develop/extensions/server-extensions' },
								},
								{ slug: 'docs/develop/extensions/bundles' },
							],
						},
					],
				},
				{ label: 'Manage', collapsed: true, autogenerate: { directory: 'docs/manage' } },
				{
					label: 'API reference',
					collapsed: true,
					items: [
						{ slug: 'docs/api' },
						{ slug: 'docs/api/introduction' },
						{ slug: 'docs/api/authentication' },
						{ slug: 'docs/api/items' },
						{ slug: 'docs/api/files' },
						{ slug: 'docs/api/filters-and-queries' },
						{ slug: 'docs/api/graphql' },
						{ slug: 'docs/api/sdk' },
						{ label: 'System Collections', collapsed: true, autogenerate: { directory: 'docs/api/system-collections' } },
					],
				},
				{ label: 'Contributing', collapsed: true, autogenerate: { directory: 'docs/contributing' } },
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
