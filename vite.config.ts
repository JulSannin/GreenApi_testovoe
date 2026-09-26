import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		// Берём алиасы из "paths" в tsconfig — не нужно дублировать их здесь
		tsconfigPaths: true,
	},
});
