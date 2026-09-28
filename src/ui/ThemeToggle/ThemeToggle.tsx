// Кнопка «Тёмная тема»: переключает светлую и тёмную тему.
// Это переключатель (aria-pressed): программа экранного доступа прочитает «Тёмная тема, нажата».
// Иконка подсказывает, что будет по нажатию: луна — станет тёмной, солнце — светлой.

import { IconButton } from '@/ui/IconButton/IconButton';
import { useTheme } from '@/ui/useTheme';

export function ThemeToggle() {
	const { theme, toggle } = useTheme();
	const isDark = theme === 'dark';

	return (
		<IconButton
			label="Тёмная тема"
			aria-pressed={isDark}
			// Подсказка при наведении мышью
			title={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
			onClick={toggle}
		>
			{isDark ? (
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
					<circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
					<path
						d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			) : (
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
					<path
						d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinejoin="round"
					/>
				</svg>
			)}
		</IconButton>
	);
}
