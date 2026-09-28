// Хук: светлая или тёмная тема сейчас и переключение между ними.
// По умолчанию тема — как в системе (это делает сам CSS, см. theme.css). Выбор кнопкой ставит
// атрибут data-theme на <html> и запоминается в localStorage. Сразу при загрузке страницы,
// ещё до React, выбор применяет короткий скрипт в index.html — иначе страница мигнула бы
// темой системы. Ключ в localStorage у них общий: THEME_STORAGE_KEY.

import { useState } from 'react';
import { useMediaQuery } from '@/ui/useMediaQuery';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'green-api-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Выбор пользователя; null — не выбирал, тема как в системе
function readChoice(): Theme | null {
	try {
		const saved = localStorage.getItem(THEME_STORAGE_KEY);
		return saved === 'light' || saved === 'dark' ? saved : null;
	} catch {
		// localStorage недоступен (например, заблокирован в настройках браузера)
		return null;
	}
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
