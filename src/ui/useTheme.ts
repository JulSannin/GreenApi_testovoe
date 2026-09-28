// Хук: светлая или тёмная тема сейчас и переключение между ними.
// По умолчанию тема — как в системе (это делает сам CSS, см. theme.css). Выбор кнопкой ставит
// атрибут data-theme на <html> и запоминается в localStorage. Сразу при загрузке страницы,
// ещё до React, выбор из localStorage ставит на <html> короткий скрипт в index.html — иначе
// страница мигнула бы темой системы. Ключ в localStorage у них общий: THEME_STORAGE_KEY
// (что скрипт читает именно его, проверяет useTheme.test.ts).

import { useState } from 'react';
import { useMediaQuery } from '@/ui/useMediaQuery';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'green-api-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Выбор пользователя; null — не выбирал, тема как в системе.
// Читаем атрибут data-theme, а не localStorage: страницу красит именно атрибут. Если localStorage
// недоступен, выбор туда не сохранится, но атрибут останется — и кнопка, появившись заново
// (например, после сужения и расширения окна), всё равно покажет ту тему, что на экране
function readChoice(): Theme | null {
	const theme = document.documentElement.dataset.theme;
	return theme === 'light' || theme === 'dark' ? theme : null;
}

function saveChoice(choice: Theme | null): void {
	const root = document.documentElement;
	if (choice) {
		root.dataset.theme = choice;
	} else {
		delete root.dataset.theme;
	}
	try {
		if (choice) {
			localStorage.setItem(THEME_STORAGE_KEY, choice);
		} else {
			localStorage.removeItem(THEME_STORAGE_KEY);
		}
	} catch {
		// Не запомнили — тема сменится только до перезагрузки страницы
	}
}

/**
 * Какой выбор запомнить после нажатия: противоположная тема. Если она совпала с системной,
 * выбор сбрасывается (null) — и тема снова следует за системой.
 */
export function nextThemeChoice(current: Theme, system: Theme): Theme | null {
	const next = current === 'dark' ? 'light' : 'dark';
	return next === system ? null : next;
}

export function useTheme(): { theme: Theme; toggle: () => void } {
	const system: Theme = useMediaQuery(DARK_QUERY) ? 'dark' : 'light';
	const [choice, setChoice] = useState(readChoice);
	const theme = choice ?? system;

	function toggle() {
		const next = nextThemeChoice(theme, system);
		saveChoice(next);
		setChoice(next);
	}

	return { theme, toggle };
}
