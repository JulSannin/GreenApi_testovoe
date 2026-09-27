import { describe, expect, it } from 'vitest';
import type { Message } from '@/store/types';
import { GROUP_GAP_MS, groupMessages } from './groupMessages';

// Время собирается из местного, поэтому тесты не зависят от часового пояса
const at = (day: number, hours: number, minutes = 0) =>
	new Date(2026, 8, day, hours, minutes).getTime();
const now = at(25, 18);

const message = (id: string, timestamp: number, patch: Partial<Message> = {}): Message => ({
	id,
	text: id,
	direction: 'out',
	timestamp,
	...patch,
});

// Лента коротко: дни — подписью, сообщения — id и «|», если сообщение последнее в группе
function layout(messages: Message[]): string[] {
	return groupMessages(messages, now).map((item) =>
		item.kind === 'day' ? `[${item.label}]` : item.message.id + (item.isLastInGroup ? '|' : ''),
	);
}

describe('groupMessages', () => {
	it('пустая переписка — пустая лента', () => {
		expect(groupMessages([], now)).toEqual([]);
	});

	it('перед первым сообщением каждого дня — разделитель', () => {
		const messages = [
			message('a', at(12, 10)),
			message('b', at(24, 23, 59)),
			message('c', at(25, 0, 1)),
			message('d', at(25, 9)),
		];
		expect(layout(messages)).toEqual([
			'[12 сентября]',
			'a|',
			'[Вчера]',
			'b|',
			'[Сегодня]',
			'c|',
			'd|',
		]);
	});

	it('подряд идущие сообщения одной стороны — одна группа', () => {
		const messages = [
			message('a', at(25, 10, 0)),
			message('b', at(25, 10, 1)),
			message('c', at(25, 10, 2), { direction: 'in' }),
			message('d', at(25, 10, 3), { direction: 'in' }),
			message('e', at(25, 10, 4)),
		];
		expect(layout(messages)).toEqual(['[Сегодня]', 'a', 'b|', 'c', 'd|', 'e|']);
	});

	it('после долгой паузы — новая группа', () => {
		const start = at(25, 10);
		const messages = [
			message('a', start),
			message('b', start + GROUP_GAP_MS),
			message('c', start + 2 * GROUP_GAP_MS + 1),
		];
		expect(layout(messages)).toEqual(['[Сегодня]', 'a', 'b|', 'c|']);
	});

	it('неотправленное сообщение заканчивает группу', () => {
		const messages = [
			message('a', at(25, 10, 0), { status: 'failed' }),
			message('b', at(25, 10, 1)),
		];
		expect(layout(messages)).toEqual(['[Сегодня]', 'a|', 'b|']);
	});

	it('ключи разделителей не повторяются, даже если день встречается дважды', () => {
		// Сообщения не по порядку: своё — по часам устройства уже «сегодня»,
		// входящее — по часам сервера ещё «вчера»
		const messages = [
			message('a', at(24, 23, 0), { direction: 'in' }),
			message('b', at(25, 0, 1)),
			message('c', at(24, 23, 59), { direction: 'in' }),
		];
		const days = groupMessages(messages, now).filter((item) => item.kind === 'day');
		expect(days.map((item) => item.label)).toEqual(['Вчера', 'Сегодня', 'Вчера']);
		expect(new Set(days.map((item) => item.key)).size).toBe(3);
	});
});
