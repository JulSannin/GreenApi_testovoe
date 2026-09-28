import { describe, expect, it } from 'vitest';
// Сам index.html как текст: скрипт темы в нём должен читать тот же ключ localStorage
import indexHtml from '/index.html?raw';
import { nextThemeChoice, THEME_STORAGE_KEY } from './useTheme';

describe('nextThemeChoice', () => {
	it('переключает на противоположную тему и запоминает выбор', () => {
		expect(nextThemeChoice('light', 'light')).toBe('dark');
		expect(nextThemeChoice('dark', 'dark')).toBe('light');
	});

	it('если новая тема совпала с системной — выбор сбрасывается, тема снова как в системе', () => {
		// Система тёмная, кнопкой выбрали светлую, а теперь снова нажали
		expect(nextThemeChoice('light', 'dark')).toBeNull();
		expect(nextThemeChoice('dark', 'light')).toBeNull();
	});
});

describe('скрипт темы в index.html', () => {
	it('читает тот же ключ localStorage, куда кнопка сохраняет выбор', () => {
		// Если ключ поменять только в одном месте, выбранная тема перестанет ставиться при загрузке
		expect(indexHtml).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`);
	});
});
