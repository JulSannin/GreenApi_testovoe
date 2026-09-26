import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

// ---------- Правила слоёв ----------
// app → pages → modules → components → ui: каждый слой импортирует только из слоёв ниже.
// api, store, utils — общая логика без интерфейса.
// Нарушение правил — ошибка `npm run lint`.

// Запрещённые слои: '^@/(pages|app)(/|$)'
function layers(names, message, options = {}) {
	return { regex: `^@/(${names.join('|')})(/|$)`, message, ...options };
}

// Во всех слоях: в чужую папку — только через @/, иначе правила слоёв легко обойти через ../
const NO_RELATIVE_UP = {
	// '..' в любом месте пути: и '../x', и './../x'
	regex: '(^|/)\\.\\.(/|$)',
	message: 'Импорт из другой папки — через алиас @/ (например, @/ui), а не через ../',
};

// Модуль открывает наружу только свой index.ts
const NO_DEEP_MODULE_IMPORT = {
	regex: '^@/modules/[^/]+/.+',
	message: 'Модуль импортируется только через его index.ts: @/modules/<имя>',
};

function restrictImports(...patterns) {
	return {
		// Версия правила из typescript-eslint: умеет разрешать импорт только типов (allowTypeImports)
		'@typescript-eslint/no-restricted-imports': [
			'error',
			{ patterns: [NO_RELATIVE_UP, ...patterns] },
		],
	};
}

const layerRules = [
	{
		files: ['src/ui/**/*.{ts,tsx}'],
		rules: restrictImports(
			layers(
				['app', 'pages', 'modules', 'components', 'api', 'store', 'utils'],
				'ui ничего не знает о приложении: только React и другие ui-компоненты',
			),
		),
	},
	{
		files: ['src/components/**/*.{ts,tsx}'],
		rules: restrictImports(
			layers(
				['app', 'pages', 'modules', 'api'],
				'components только показывают данные: без модулей и API, всё через props',
			),
			layers(['store'], 'components не работают со стором — можно только типы (import type)', {
				allowTypeImports: true,
			}),
		),
	},
	{
		files: ['src/modules/**/*.{ts,tsx}'],
		rules: restrictImports(
			layers(['app', 'pages'], 'Модуль не знает, на какой странице и в каком приложении стоит'),
			layers(
				['modules'],
				'Модули не импортируют друг друга (внутри модуля — через ./). Связывает модули страница',
			),
		),
	},
	{
		files: ['src/pages/**/*.{ts,tsx}'],
		rules: restrictImports(
			layers(['app', 'api'], 'Страница собирает модули; запросы к API — внутри модулей'),
			NO_DEEP_MODULE_IMPORT,
		),
	},
	{
		files: ['src/app/**/*.{ts,tsx}', 'src/main.tsx'],
		rules: restrictImports(
			layers(['api'], 'Запросы к API — внутри модулей'),
			NO_DEEP_MODULE_IMPORT,
		),
	},
	{
		files: ['src/{api,store,utils}/**/*.{ts,tsx}'],
		rules: restrictImports(
			layers(
				['app', 'pages', 'modules', 'components', 'ui'],
				'api, store и utils — логика без интерфейса: слои с компонентами им недоступны',
			),
		),
	},
];

export default defineConfig([
	globalIgnores(['dist']),
	{
		files: ['**/*.{ts,tsx}'],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
			eslintConfigPrettier,
		],
		languageOptions: {
			globals: globals.browser,
		},
	},
	...layerRules,
]);
