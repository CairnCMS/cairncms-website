// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
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
