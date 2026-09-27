import { describe, expect, it } from 'vitest';
import { parseHistory } from './parseHistory';

// Сообщения по примерам из документации getChatHistory
const outgoing = {
	type: 'outgoing',
	idMessage: 'OUT-1',
	timestamp: 1754999812,
	typeMessage: 'extendedTextMessage',
	chatId: '10000000',
	chatType: 'user',
	textMessage: 'Я отправил это с телефона',
	statusMessage: '',
	sendByApi: false,
};
const incoming = {
	type: 'incoming',
	idMessage: 'IN-1',
	timestamp: 1754986980,
	typeMessage: 'textMessage',
	chatId: '10000000',
	chatType: 'user',
	textMessage: 'Привет',
	senderId: '10000000',
	senderName: 'Иван',
};

describe('parseHistory', () => {
	it('входящие и исходящие; время — в миллисекундах; исходящее уже отправлено', () => {
		expect(parseHistory([outgoing, incoming])).toEqual([
			{
				id: 'OUT-1',
				text: 'Я отправил это с телефона',
				direction: 'out',
				timestamp: 1754999812000,
				status: 'sent',
			},
			{ id: 'IN-1', text: 'Привет', direction: 'in', timestamp: 1754986980000 },
		]);
	});

	it('фото — заглушка, реакции — пропускаются', () => {
		const result = parseHistory([
			{ ...incoming, idMessage: 'IMG', typeMessage: 'imageMessage', textMessage: undefined },
			{ ...incoming, idMessage: 'REACT', typeMessage: 'reactionMessage' },
		]);

		expect(result).toEqual([
			expect.objectContaining({
				id: 'IMG',
				text: 'Фото — этот тип сообщений пока не поддерживается',
				unsupported: true,
			}),
		]);
	});

	it('записи без id, времени или направления и неожиданного вида пропускаются', () => {
		expect(
			parseHistory([
				null,
				'сообщение',
				{ ...incoming, idMessage: undefined },
				{ ...incoming, timestamp: 'вчера' },
				{ ...incoming, type: 'system' },
				{ ...incoming, textMessage: { html: 'Привет' } },
			]),
		).toEqual([
			expect.objectContaining({ id: 'IN-1', unsupported: true, text: expect.any(String) }),
		]);
	});

	it('не массив — пустая история', () => {
		expect(parseHistory({ messages: [] })).toEqual([]);
	});
});
