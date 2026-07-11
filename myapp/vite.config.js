import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// An empty ANTHROPIC_API_KEY in the process environment (e.g. a stray
// `export ANTHROPIC_API_KEY=""`) would otherwise take priority over the
// value in .env and break all Claude API calls.
if (process.env.ANTHROPIC_API_KEY === '') {
	delete process.env.ANTHROPIC_API_KEY;
}

export default defineConfig({
	plugins: [sveltekit()]
});
