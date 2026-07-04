import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Plain-Node test config on purpose: the pedagogy core is framework-free and
// must be testable without the SvelteKit plugin (architecture.md §3).
export default defineConfig({
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
	}
});
