import { describe, expect, it } from 'vitest';
import type { WebhookBody } from '@/api/types';
import { parseNotification, resolveChatKey, type ParsedMessage } from './parseNotification';

const NOW = 1_800_000_000_000;

// Входящее текстовое сообщение в личном чате — по примеру из документации GREEN-API.
// Нужные поля в тестах переопределяются
function incoming(overrides: Partial<WebhookBody> = {}): WebhookBody {
	return {
		typeWebhook: 'incomingMessageReceived',
		timestamp: 1763115112,
		idMessage: '1763115112345',
		senderData: {
			chatId: '10000000',
			chatType: 'user',
			chatName: 'Иван из профиля',
			sender: '10000000',
			senderName: 'Иван из профиля',
			senderContactName: 'Иван',
			senderPhoneNumber: 79876543210,
		},
		messageData: {
			typeMessage: 'textMessage',
			textMessageData: { textMessage: 'Привет' },
		},
		...overrides,
	};
}

// То же сообщение с другими данными отправителя
function fromSender(senderData: Partial<NonNullable<WebhookBody['senderData']>>): WebhookBody {
	const base = incoming();
	return { ...base, senderData: { ...base.senderData!, ...senderData } };
}

// То же сообщение с другим содержимым
function withMessageData(messageData: WebhookBody['messageData']): WebhookBody {
	return incoming({ messageData });
}

describe('parseNotification: текстовое сообщение', () => {
	it('кладёт сообщение в чат по номеру телефона', () => {
		expect(parseNotification(incoming(), NOW)).toEqual({
			chatKey: '79876543210',
			chatId: '79876543210@c.us',
			maxChatId: '10000000',
			name: 'Иван',
			message: {
				id: '1763115112345',
				text: 'Привет',
				direction: 'in',
				timestamp: 1763115112000,
			},
		});
	});

	it('без номера (0) — чат ищется по id в MAX, ответ уходит туда же', () => {
		const result = parseNotification(fromSender({ senderPhoneNumber: 0 }), NOW);

		expect(result).toMatchObject({ chatKey: null, chatId: '10000000', maxChatId: '10000000' });
	});

	it('имя: сначала из контактов, потом из профиля, потом название чата', () => {
		expect(parseNotification(fromSender({ senderContactName: '' }), NOW)?.name).toBe(
			'Иван из профиля',
		);
		expect(
			parseNotification(
				fromSender({ senderContactName: ' ', senderName: undefined, chatName: 'Чат' }),
				NOW,
			)?.name,
		).toBe('Чат');
	});

	it('без имён — name не задан', () => {
		const result = parseNotification(
			fromSender({ senderContactName: '', senderName: '', chatName: undefined }),
			NOW,
		);

		expect(result?.name).toBeUndefined();
	});

	it('текст со ссылкой и ответ на сообщение — тоже текст', () => {
		for (const typeMessage of ['extendedTextMessage', 'quotedMessage']) {
			const result = parseNotification(
				withMessageData({ typeMessage, extendedTextMessageData: { text: 'Смотри ссылку' } }),
				NOW,
			);
			expect(result?.message.text).toBe('Смотри ссылку');
			expect(result?.message.unsupported).toBeUndefined();
		}
	});

	it('кривое время заменяет текущим', () => {
		expect(parseNotification(incoming({ timestamp: NaN }), NOW)?.message.timestamp).toBe(NOW);
		expect(parseNotification(incoming({ timestamp: 0 }), NOW)?.message.timestamp).toBe(NOW);
	});
});

describe('parseNotification: не-текстовые сообщения', () => {
	it('фото — заглушка с пометкой unsupported', () => {
		const result = parseNotification(withMessageData({ typeMessage: 'imageMessage' }), NOW);

		expect(result?.message).toMatchObject({
			text: 'Фото — этот тип сообщений пока не поддерживается',
			unsupported: true,
		});
	});

	it('неизвестный тип — общая заглушка', () => {
		const result = parseNotification(withMessageData({ typeMessage: 'somethingNew' }), NOW);

		expect(result?.message.text).toBe('Сообщение — этот тип сообщений пока не поддерживается');
	});

	it.each(['reactionMessage', 'editedMessage', 'deletedMessage'])(
		'%s — не показывается',
		(typeMessage) => {
			expect(parseNotification(withMessageData({ typeMessage }), NOW)).toBeNull();
		},
	);
});

describe('parseNotification: сообщение, отправленное с телефона', () => {
	// По документации в исходящем senderData описывает отправителя — владельца аккаунта
	const fromPhone = (): WebhookBody =>
		incoming({
			typeWebhook: 'outgoingMessageReceived',
			senderData: {
				chatId: '10000000',
				chatType: 'user',
				sender: '10000000',
				senderName: 'Владелец',
				senderPhoneNumber: 79991234567,
			},
		});

	it('исходящее, уже отправленное; чат — по id в MAX, номер и имя владельца не берутся', () => {
		expect(parseNotification(fromPhone(), NOW)).toEqual({
			chatKey: null,
			chatId: '10000000',
			maxChatId: '10000000',
			name: undefined,
			message: {
				id: '1763115112345',
				text: 'Привет',
				direction: 'out',
				status: 'sent',
				timestamp: 1763115112000,
			},
		});
	});
});

describe('resolveChatKey', () => {
	const parsed = (
		patch: Partial<ParsedMessage>,
		direction: 'in' | 'out' = 'in',
	): ParsedMessage => ({
		chatKey: null,
		chatId: '10000000',
		maxChatId: '10000000',
		message: { id: 'X', text: 'Привет', direction, timestamp: 1 },
		...patch,
	});
	const known = (maxChatId: string) => (maxChatId === '10000000' ? '79876543210' : undefined);
	const unknown = () => undefined;

	it('есть номер, чат по id в MAX неизвестен — чат по номеру', () => {
		expect(resolveChatKey(parsed({ chatKey: '79876543210' }), unknown)).toBe('79876543210');
	});

	it('есть номер, но чат с этим id в MAX уже заведён (номер был скрыт) — туда, а не в новый', () => {
		const byMaxId = (maxChatId: string) => (maxChatId === '10000000' ? '10000000' : undefined);

		expect(resolveChatKey(parsed({ chatKey: '79876543210' }), byMaxId)).toBe('10000000');
	});

	it('нет номера, но чат с таким id в MAX известен — он', () => {
		expect(resolveChatKey(parsed({}), known)).toBe('79876543210');
		expect(resolveChatKey(parsed({}, 'out'), known)).toBe('79876543210');
	});

	it('входящее от незнакомого без номера — новый чат по id в MAX', () => {
		expect(resolveChatKey(parsed({}), unknown)).toBe('10000000');
	});

	it('исходящее в незнакомый чат — не показываем', () => {
		expect(resolveChatKey(parsed({}, 'out'), unknown)).toBeNull();
	});
});

describe('parseNotification: что пропускается', () => {
	it.each(['outgoingAPIMessageReceived', 'outgoingMessageStatus', 'stateInstanceChanged'])(
		'уведомление %s',
		(typeWebhook) => {
			expect(parseNotification(incoming({ typeWebhook }), NOW)).toBeNull();
		},
	);

	it('сообщение из группы', () => {
		const group = fromSender({
			chatId: '-69876543210123',
			chatType: 'group',
			senderPhoneNumber: 0,
		});

		expect(parseNotification(group, NOW)).toBeNull();
	});

	it('без id сообщения или без отправителя', () => {
		expect(parseNotification(incoming({ idMessage: undefined }), NOW)).toBeNull();
		expect(parseNotification(incoming({ senderData: undefined }), NOW)).toBeNull();
	});

	it('группа без chatType — узнаём по отрицательному chatId', () => {
		const group = fromSender({
			chatId: '-69876543210123',
			chatType: undefined,
			senderPhoneNumber: 0,
		});

		expect(parseNotification(group, NOW)).toBeNull();
	});

	it('если chatType не пришёл — считаем чат личным', () => {
		expect(parseNotification(fromSender({ chatType: undefined }), NOW)).not.toBeNull();
	});
});

// Данные приходят с чужого сервера: разбор не должен падать ни на каком входе
describe('parseNotification: уведомления неожиданного вида', () => {
	// Подменяет поле на значение «не того» типа, в обход TypeScript
	const broken = (patch: Record<string, unknown>): unknown => ({ ...incoming(), ...patch });
	const brokenSender = (patch: Record<string, unknown>): unknown =>
		broken({ senderData: { ...incoming().senderData, ...patch } });
	const brokenMessageData = (patch: Record<string, unknown>): unknown =>
		broken({ messageData: { ...incoming().messageData, ...patch } });

	it.each([null, undefined, 'строка', 42, [], [incoming()]])('тело %j — пропускается', (body) => {
		expect(parseNotification(body, NOW)).toBeNull();
	});

	it('без chatId — пропускается, а не падает', () => {
		expect(parseNotification(brokenSender({ chatId: undefined }), NOW)).toBeNull();
	});

	it('senderData или messageData не объектом — пропускается', () => {
		expect(parseNotification(broken({ senderData: 'Иван' }), NOW)).toBeNull();
		expect(parseNotification(broken({ messageData: ['textMessage'] }), NOW)).toBeNull();
	});

	it('typeMessage не строкой — пропускается', () => {
		expect(parseNotification(brokenMessageData({ typeMessage: 1 }), NOW)).toBeNull();
	});

	it('chatId и idMessage числами — превращаются в строки', () => {
		const result = parseNotification(
			broken({
				idMessage: 1763115112345,
				senderData: { ...incoming().senderData, chatId: 10000000, senderPhoneNumber: 0 },
			}),
			NOW,
		);

		expect(result).toMatchObject({
			chatKey: null,
			chatId: '10000000',
			maxChatId: '10000000',
			message: { id: '1763115112345' },
		});
	});

	it('имя не строкой — пропускается, берётся следующее', () => {
		const result = parseNotification(brokenSender({ senderContactName: 12345 }), NOW);

		expect(result?.name).toBe('Иван из профиля');
	});

	it('текст объектом — заглушка, а не объект в сторе', () => {
		const result = parseNotification(
			brokenMessageData({ textMessageData: { textMessage: { html: 'Привет' } } }),
			NOW,
		);

		expect(typeof result?.message.text).toBe('string');
		expect(result?.message).toMatchObject({ unsupported: true });
	});

	it('номер телефона строкой из цифр — принимается, мусор — нет', () => {
		expect(
			parseNotification(brokenSender({ senderPhoneNumber: '79876543210' }), NOW)?.chatKey,
		).toBe('79876543210');
		expect(
			parseNotification(brokenSender({ senderPhoneNumber: 'скрыт' }), NOW)?.chatKey,
		).toBeNull();
		expect(parseNotification(brokenSender({ senderPhoneNumber: 12.5 }), NOW)?.chatKey).toBeNull();
	});

	it('время строкой — текущее', () => {
		expect(parseNotification(broken({ timestamp: '1763115112' }), NOW)?.message.timestamp).toBe(
			NOW,
		);
	});
});
