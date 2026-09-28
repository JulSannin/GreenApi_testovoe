// Тест theme.css: тёмная тема записана двумя одинаковыми наборами (по системе и по кнопке).
// Если поправить цвет только в одном, тема по кнопке и тема по системе разойдутся — тест это поймает.

import { describe, expect, it } from 'vitest';
import css from './theme.css?raw';

// Переменные --имя: значение из блока, который начинается после selector
function variables(selector: string): Record<string, string> {
	const start = css.indexOf(selector);
	if (start < 0) throw new Error(`В theme.css нет блока ${selector}`);
	const open = css.indexOf('{', start);
	const close = css.indexOf('}', open);
	const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
	return Object.fromEntries(
		[...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
	);
}

describe('theme.css', () => {
	it('тёмная тема по системе и по кнопке — одинаковые цвета', () => {
		const bySystem = variables(":root:not([data-theme='light'])");
		const byButton = variables(":root[data-theme='dark']");

		expect(Object.keys(bySystem).length).toBeGreaterThan(10);
		expect(byButton).toEqual(bySystem);
	});
});
