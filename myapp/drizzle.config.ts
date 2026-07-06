import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/tutor/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: process.env.DATABASE_PATH ?? 'data/happy-bear.db'
	}
});
