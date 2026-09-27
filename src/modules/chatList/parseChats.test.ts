import { describe, expect, it } from 'vitest';
import { parseChats } from './parseChats';

describe('parseChats', () => {
	it('личный чат с номером — ключ по номеру, имя, id в MAX', () => {
		expect(
			parseChats([{ chatId: '10000000', name: 'Иван', type: 'user', phoneNumber: 79876543210 }]),
		).toEqual([
			{ key: '79876543210', chatId: '79876543210@c.us', maxChatId: '10000000', name: 'Иван' },
		]);
	});

	it('номер скрыт (0) — ключ и адрес по id в MAX', () => {
		expect(
			parseChats([{ chatId: '10000000', name: 'Аноним', type: 'user', phoneNumber: 0 }]),
		).toEqual([{ key: '10000000', chatId: '10000000', maxChatId: '10000000', name: 'Аноним' }]);
	});

	it('группы, каналы и боты пропускаются', () => {
		expect(
			parseChats([
				{ chatId: '-10000000000000', name: 'Группа', type: 'group', phoneNumber: 0 },
				{ chatId: '20000000', name: 'Канал', type: 'channel', phoneNumber: 0 },
				{ chatId: '30000000', name: 'Бот', type: 'bot', phoneNumber: 0 },
				{ chatId: '-40000000', name: 'Группа без type', phoneNumber: 0 },
			]),
		).toEqual([]);
	});

	it('записи неожиданного вида пропускаются, остальные — нет', () => {
		const chats = parseChats([
			null,
			'чат',
			{ name: 'Без chatId', type: 'user' },
			{ chatId: 10000000, name: 12345, type: 'user', phoneNumber: 'скрыт' },
		]);

		expect(chats).toEqual([
			{ key: '10000000', chatId: '10000000', maxChatId: '10000000', name: undefined },
		]);
	});

	it('не массив — пустой список', () => {
		expect(parseChats({ chats: [] })).toEqual([]);
		expect(parseChats(null)).toEqual([]);
	});
});
