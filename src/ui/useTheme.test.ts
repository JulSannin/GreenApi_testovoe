import { describe, expect, it } from 'vitest';
import { nextThemeChoice } from './useTheme';

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
