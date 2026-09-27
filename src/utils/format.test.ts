import { describe, expect, it } from 'vitest';
import type { Chat } from '@/store/types';
import {
	chatAddress,
	chatTitle,
	formatChatTime,
	formatDay,
	formatPhone,
	formatTime,
	initials,
} from './format';

describe('formatPhone', () => {
	it('разбивает российский номер на группы', () => {
		expect(formatPhone('79991234567')).toBe('+7 999 123-45-67');
	});

	it('другие номера показывает как «+» и цифры', () => {
		expect(formatPhone('375291234567')).toBe('+375291234567');
	});
});

describe('chatAddress', () => {
	it('для чата по номеру показывает номер', () => {
		const chat: Chat = { id: '79991234567', chatId: '79991234567@c.us', lastMessageAt: 0 };
		expect(chatAddress(chat)).toBe('+7 999 123-45-67');
	});

	it('для чата без номера показывает id чата в MAX', () => {
		const chat: Chat = { id: '10000000', chatId: '10000000', lastMessageAt: 0 };
		expect(chatAddress(chat)).toBe('10000000');
	});
});

describe('chatTitle', () => {
	const byPhone: Chat = { id: '79991234567', chatId: '79991234567@c.us', lastMessageAt: 0 };

	it('показывает имя собеседника, если оно есть', () => {
		expect(chatTitle({ ...byPhone, name: 'Иван' })).toBe('Иван');
	});

	it('без имени (или с пустым) показывает номер', () => {
		expect(chatTitle(byPhone)).toBe('+7 999 123-45-67');
		expect(chatTitle({ ...byPhone, name: '  ' })).toBe('+7 999 123-45-67');
	});
});

describe('formatTime', () => {
	it('показывает часы и минуты с ведущим нулём', () => {
		// Дата собирается из местного времени, поэтому тест не зависит от часового пояса
		expect(formatTime(new Date(2026, 8, 25, 9, 5).getTime())).toBe('09:05');
	});
});

describe('formatChatTime', () => {
	const now = new Date(2026, 8, 25, 18, 0).getTime();

	it('сегодня — время', () => {
		expect(formatChatTime(new Date(2026, 8, 25, 14, 5).getTime(), now)).toBe('14:05');
	});

	it('в этом году — день и месяц', () => {
		expect(formatChatTime(new Date(2026, 8, 24, 23, 59).getTime(), now)).toBe('24.09');
	});

	it('в прошлые годы — полная дата', () => {
		expect(formatChatTime(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe('31.12.25');
	});
});

describe('initials', () => {
	it('первые буквы первых двух слов', () => {
		expect(initials('Иван Петров')).toBe('ИП');
		expect(initials('Анна Мария Иванова')).toBe('АМ');
	});

	it('одно слово — одна буква', () => {
		expect(initials('Никита')).toBe('Н');
	});

	it('маленькие буквы становятся большими', () => {
		expect(initials('ivan petrov')).toBe('IP');
	});

	it('пропускает эмодзи, кавычки и цифры', () => {
		expect(initials('😀 Анна')).toBe('А');
		expect(initials('«Никита»')).toBe('Н');
		expect(initials('2 Анна')).toBe('А');
	});

	it('без имени или без букв — пусто (аватар покажет иконку)', () => {
		expect(initials(undefined)).toBe('');
		expect(initials('')).toBe('');
		expect(initials('   ')).toBe('');
		expect(initials('+7 999 123-45-67')).toBe('');
	});
});

describe('formatDay', () => {
	const now = new Date(2026, 8, 25, 0, 30).getTime();

	it('сегодня и вчера — словами', () => {
		expect(formatDay(new Date(2026, 8, 25, 0, 1).getTime(), now)).toBe('Сегодня');
		expect(formatDay(new Date(2026, 8, 24, 23, 59).getTime(), now)).toBe('Вчера');
	});

	it('вчера — и через границу месяца и года', () => {
		const newYear = new Date(2026, 0, 1, 10, 0).getTime();
		expect(formatDay(new Date(2025, 11, 31, 22, 0).getTime(), newYear)).toBe('Вчера');
	});

	it('в этом году — день и месяц словом', () => {
		expect(formatDay(new Date(2026, 8, 12, 12, 0).getTime(), now)).toBe('12 сентября');
	});

	it('в прошлые годы — с годом', () => {
		expect(formatDay(new Date(2025, 8, 12, 12, 0).getTime(), now)).toBe('12 сентября 2025 г.');
	});
});
