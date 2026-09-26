// Форматирование номера и времени для показа в интерфейсе.

import type { Chat } from '@/store/types';

/**
 * Номер для показа: '79991234567' → '+7 999 123-45-67'.
 * Российские номера разбиваются на группы, остальные показываются как «+» и цифры.
 */
export function formatPhone(phone: string): string {
	const ru = /^7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(phone);
	if (ru) {
		const [, code, first, second, third] = ru;
		return `+7 ${code} ${first}-${second}-${third}`;
	}
	return `+${phone}`;
}

/**
 * Заголовок чата. Чат, созданный по номеру, отправляет на адрес '...@c.us' — показываем номер.
 * Чат без номера (пришёл только id чата в MAX) показываем по этому id.
 */
export function chatTitle(chat: Chat): string {
	return chat.chatId.endsWith('@c.us') ? formatPhone(chat.id) : chat.id;
}

// Intl.DateTimeFormat создаётся один раз: это заметно быстрее, чем на каждый вызов
const timeFormat = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayMonthFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });
const fullDateFormat = new Intl.DateTimeFormat('ru-RU', {
	day: '2-digit',
	month: '2-digit',
	year: '2-digit',
});

// Время сообщения: '14:05'
export function formatTime(ms: number): string {
	return timeFormat.format(ms);
}

/**
 * Время в списке чатов: сегодня — '14:05', в этом году — '25.09', раньше — '25.09.25'.
 * now передаётся параметром, чтобы тесты не зависели от текущей даты.
 */
export function formatChatTime(ms: number, now = Date.now()): string {
	const date = new Date(ms);
	const today = new Date(now);
	if (date.toDateString() === today.toDateString()) {
		return formatTime(ms);
	}
	if (date.getFullYear() === today.getFullYear()) {
		return dayMonthFormat.format(date);
	}
	return fullDateFormat.format(date);
}
