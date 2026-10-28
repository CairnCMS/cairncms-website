// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightPageActions from 'starlight-page-actions';
import starlightThemeRapide from 'starlight-theme-rapide';
import { existsSync } from 'node:fs';

// CairnCMS 1.7.0 turns the config-as-code page into a section. Deploys build
// against whichever cairncms docs were synced, and cairncms main keeps the
// single page until that release, so Manage lists the section only when it is
// there. Autogenerate would label its folders by their raw names.
const hasConfigSection = existsSync(new URL('./src/content/docs/docs/manage/config-as-code/index.md', import.meta.url));

const manageItems = hasConfigSection
	? [
			{ slug: 'docs/manage' },
			{ slug: 'docs/manage/configuration' },
			{ slug: 'docs/manage/deployment' },
			{ slug: 'docs/manage/security-hardening' },
			{ slug: 'docs/manage/backups' },
			{ slug: 'docs/manage/upgrades' },
			{ slug: 'docs/manage/migration-between-instances' },
			{ slug: 'docs/manage/schema-as-code' },
			{
				label: 'Config-as-code',
				collapsed: true,
				items: [
					{ slug: 'docs/manage/config-as-code' },
					{ slug: 'docs/manage/config-as-code/first-apply' },
					{ slug: 'docs/manage/config-as-code/deployments' },
					{ slug: 'docs/manage/config-as-code/scope-and-deletions' },
					{ slug: 'docs/manage/config-as-code/remote' },
					{ slug: 'docs/manage/config-as-code/cli' },
					{ slug: 'docs/manage/config-as-code/http-api' },
					{ slug: 'docs/manage/config-as-code/output' },
					{ slug: 'docs/manage/config-as-code/recovery' },
					{ slug: 'docs/manage/config-as-code/migration' },
					{
						label: 'Files and resources',
						collapsed: true,
						items: [{ autogenerate: { directory: 'docs/manage/config-as-code/resources', collapsed: true } }],
					},
				],
			},
		]
	: [{ autogenerate: { directory: 'docs/manage', collapsed: true } }];

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
								{ slug: 'docs/develop/extensions/bundles' },
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
							],
						},
					],
				},
				{ label: 'Manage', collapsed: true, items: manageItems },
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
