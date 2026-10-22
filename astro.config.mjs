// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightPageActions from 'starlight-page-actions';
import starlightThemeRapide from 'starlight-theme-rapide';

export default defineConfig({
	site: 'https://cairncms.dev',
	// Astro 7 strips whitespace between elements by JSX rules by default, which
	// drops spaces the templates rely on. Keep the HTML-aware compression.
	compressHTML: true,
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
				{ label: 'Getting started', items: [{ autogenerate: { directory: 'docs/getting-started' } }] },
				{
					label: 'Guides',
					collapsed: true,
					items: [
						{ slug: 'docs/guides' },
						{ slug: 'docs/guides/auth' },
						{ slug: 'docs/guides/extensions' },
						{ slug: 'docs/guides/files' },
						{ slug: 'docs/guides/insights' },
						{ slug: 'docs/guides/permissions' },
						{ slug: 'docs/guides/settings' },
						{ slug: 'docs/guides/users' },
						{ label: 'Content Module', collapsed: true, items: [{ autogenerate: { directory: 'docs/guides/content', collapsed: true } }] },
						{ label: 'Data Model', collapsed: true, items: [{ autogenerate: { directory: 'docs/guides/data-model', collapsed: true } }] },
						{ label: 'Flows', collapsed: true, items: [{ autogenerate: { directory: 'docs/guides/flows', collapsed: true } }] },
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
								{ slug: 'docs/develop/extensions/settings' },
								{
									label: 'App extensions',
									collapsed: true,
									items: [{ autogenerate: { directory: 'docs/develop/extensions/app-extensions', collapsed: true } }],
								},
								{
									label: 'Server extensions',
									collapsed: true,
									items: [{ autogenerate: { directory: 'docs/develop/extensions/server-extensions', collapsed: true } }],
								},
								{ slug: 'docs/develop/extensions/bundles' },
							],
						},
					],
				},
				{ label: 'Manage', collapsed: true, items: [{ autogenerate: { directory: 'docs/manage', collapsed: true } }] },
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
						{ label: 'Realtime', collapsed: true, items: [{ autogenerate: { directory: 'docs/api/realtime', collapsed: true } }] },
						{ label: 'System Collections', collapsed: true, items: [{ autogenerate: { directory: 'docs/api/system-collections', collapsed: true } }] },
					],
				},
				{ label: 'Contributing', collapsed: true, items: [{ autogenerate: { directory: 'docs/contributing', collapsed: true } }] },
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
