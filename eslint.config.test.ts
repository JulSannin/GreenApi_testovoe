// Тест правил слоёв из eslint.config.js: если правила сломаются при правке конфига,
// упадёт этот тест, а не пройдёт молча линтер.
// Каждый случай — строка импорта в файле из определённого слоя: нарушает она правила или нет.
// Файлов на диске нет: ESLint проверяет текст так, будто он лежит по указанному пути.

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RULE = '@typescript-eslint/no-restricted-imports';
const eslint = new ESLint();

// Первый запуск ESLint долгий: он загружает конфиг, плагины и парсер TypeScript.
// Прогреваем его заранее с запасом по времени — иначе, когда параллельно идут остальные тесты,
// первая проверка может не уложиться в стандартные 5 секунд и упасть по таймауту
beforeAll(async () => {
	await eslint.lintText('export {};\n', { filePath: 'src/ui/warmup.ts' });
}, 120_000);

// Сколько нарушений правил импорта ESLint нашёл в коде code, лежащем в filePath
async function importErrors(filePath: string, code: string): Promise<string[]> {
	const [result] = await eslint.lintText(code, { filePath });
	return result.messages.filter((m) => m.ruleId === RULE).map((m) => m.message);
}

// Импорт и сразу реэкспорт — чтобы не срабатывало правило о неиспользуемых переменных
const valueImport = (from: string) => `import { x } from '${from}';\nexport { x };\n`;
const typeImport = (from: string) => `import type { X } from '${from}';\nexport type { X };\n`;

// [описание, путь файла, код, должно ли быть нарушение]
const cases: [string, string, string, boolean][] = [
	// ui
	['ui → store', 'src/ui/Button/Button.tsx', valueImport('@/store/chatStore'), true],
	['ui → свой index.ts', 'src/ui/TextField/TextField.tsx', valueImport('@/ui'), true],
	['ui → другой ui-файл', 'src/ui/TextField/TextField.tsx', valueImport('@/ui/Input/Input'), false],
	['ui → через ../', 'src/ui/TextField/TextField.tsx', valueImport('../Input/Input'), true],

	// components
	['components → стор', 'src/components/X/X.tsx', valueImport('@/store/chatStore'), true],
	['components → тип из стора', 'src/components/X/X.tsx', typeImport('@/store/types'), false],
	['components → API', 'src/components/X/X.tsx', valueImport('@/api/greenApi'), true],
	['components → модуль', 'src/components/X/X.tsx', valueImport('@/modules/auth'), true],
	['components → свой index.ts', 'src/components/X/X.tsx', valueImport('@/components'), true],
	['components → ui', 'src/components/X/X.tsx', valueImport('@/ui'), false],

	// modules
	['модуль → другой модуль', 'src/modules/auth/X.tsx', valueImport('@/modules/chatList'), true],
	[
		'модуль → файл другого модуля',
		'src/modules/auth/X.tsx',
		valueImport('@/modules/chatList/ChatList'),
		true,
	],
	['модуль → свой файл через @/', 'src/modules/auth/X.tsx', valueImport('@/modules/auth/Y'), false],
	['модуль → свой файл через ./', 'src/modules/auth/X.tsx', valueImport('./Y'), false],
	['модуль → свой index.ts', 'src/modules/auth/X.tsx', valueImport('@/modules/auth'), true],
	['модуль → через ./../', 'src/modules/auth/X.tsx', valueImport('./../chatList/ChatList'), true],
	['модуль → страница', 'src/modules/auth/X.tsx', valueImport('@/pages/ChatPage/ChatPage'), true],
	[
		'модуль → API, стор, components, ui',
		'src/modules/auth/X.tsx',
		valueImport('@/api/greenApi'),
		false,
	],

	// pages
	['страница → модуль через index.ts', 'src/pages/P/P.tsx', valueImport('@/modules/auth'), false],
	[
		'страница → файл модуля в обход index.ts',
		'src/pages/P/P.tsx',
		valueImport('@/modules/auth/LoginForm'),
		true,
	],
	['страница → другая страница', 'src/pages/P/P.tsx', valueImport('@/pages/Q/Q'), true],
	['страница → API', 'src/pages/P/P.tsx', valueImport('@/api/greenApi'), true],
	['страница → стор', 'src/pages/P/P.tsx', valueImport('@/store/chatStore'), false],

	// app
	['app → страница', 'src/app/App.tsx', valueImport('@/pages/ChatPage/ChatPage'), false],
	['app → API', 'src/app/App.tsx', valueImport('@/api/greenApi'), true],

	// api, store, utils
	['стор → ui', 'src/store/chatStore.ts', valueImport('@/ui'), true],
	['utils → components', 'src/utils/format.ts', valueImport('@/components'), true],
	['стор → utils', 'src/store/chatStore.ts', valueImport('@/utils/phone'), false],
];

describe('правила импорта между слоями', () => {
	it.each(cases)('%s', async (_, filePath, code, shouldFail) => {
		const errors = await importErrors(filePath, code);

		if (shouldFail) {
			expect(errors).toHaveLength(1);
		} else {
			expect(errors).toEqual([]);
		}
	});
});
