import react from '@vitejs/plugin-react';
// defineConfig из vitest/config — тот же, что у Vite, но знает ещё и настройки тестов (test)
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		// Берём алиасы из "paths" в tsconfig — не нужно дублировать их здесь
		tsconfigPaths: true,
	},
	test: {
		// В тестах CSS по умолчанию пустой. theme.css нужен настоящий:
		// theme.test.ts сверяет в нём два набора цветов тёмной темы
		css: { include: [/theme\.css/] },
	},
});
