import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Enforces architecture.md §3: the pedagogy core stays framework-free.
// Non-test modules in this directory may not import Svelte, SvelteKit
// aliases, env, the DB layer, or the Anthropic SDK.
const FORBIDDEN =
	/^(svelte|@sveltejs\/|\$app\/|\$env\/|\$lib\/server\/|@anthropic-ai\/|better-sqlite3|drizzle)/;

describe('pedagogy core is framework-free', () => {
	const dir = new URL('.', import.meta.url).pathname;
	const sources = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

	it('has modules to check', () => {
		expect(sources.length).toBeGreaterThan(0);
	});

	it.each(sources)('%s imports nothing framework-bound', (file) => {
		const text = readFileSync(join(dir, file), 'utf8');
		const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
		for (const spec of specs) {
			expect(spec, `${file} imports '${spec}'`).not.toMatch(FORBIDDEN);
		}
	});
});
