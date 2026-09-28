// Тесты отправки: настоящий fetch подменяется заглушкой, а стор проверяется через getState().

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/greenApi';
import type { Credentials } from '@/api/types';
import { useChatStore } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import {
	createLocalId,
	describeSendError,
	retryChatMessage,
	sendChatMessage,
} from './sendChatMessage';

const credentials: Credentials = {
	apiUrl: 'https://api.example.com',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};

const chat: Chat = { id: '79991234567', chatId: '79991234567@c.us', lastMessageAt: 0 };

const fetchMock = vi.fn<typeof fetch>();
const store = () => useChatStore.getState();
const messages = () => store().messages[chat.id] ?? [];

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	useChatStore.setState(useChatStore.getInitialState(), true);
	store().login(credentials);
	store().createChat(chat.id);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

function reply(body: string, status = 200) {
	fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

// Ответ сервера, который придёт только когда тест вызовет resolve — чтобы увидеть статус 'sending'
function replyLater() {
	let resolve!: (response: Response) => void;
	fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
	return (body: string, status = 200) => resolve(new Response(body, { status }));
}

describe('sendChatMessage', () => {
	it('показывает сообщение сразу, до ответа сервера', async () => {
		const respond = replyLater();

		const sending = sendChatMessage(chat, 'Привет');

		expect(messages()).toHaveLength(1);
		expect(messages()[0]).toMatchObject({ text: 'Привет', direction: 'out', status: 'sending' });
		expect(messages()[0].id).toMatch(/^local-/);

		respond(JSON.stringify({ idMessage: 'BAE5' }));
		await sending;
	});

	it('после ответа заменяет временный id на idMessage и ставит статус sent', async () => {
		reply(JSON.stringify({ idMessage: 'BAE5' }));

		await sendChatMessage(chat, 'Привет');

		expect(messages()).toEqual([
			expect.objectContaining({ id: 'BAE5', text: 'Привет', status: 'sent' }),
		]);
	});

	it('отправляет текст на адрес чата и с таймаутом', async () => {
		reply(JSON.stringify({ idMessage: 'BAE5' }));

		await sendChatMessage(chat, 'Привет');

		const [url, init] = fetchMock.mock.lastCall ?? [];
		expect(url).toContain('/sendMessage/');
		expect(JSON.parse(init?.body as string)).toEqual({
			chatId: '79991234567@c.us',
			message: 'Привет',
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it('при ошибке оставляет сообщение со статусом failed и текстом ошибки', async () => {
		reply('', 401);

		await sendChatMessage(chat, 'Привет');

		expect(messages()[0]).toMatchObject({
			text: 'Привет',
			status: 'failed',
			error: 'Сессия недействительна, войдите заново',
		});
	});

	it('без данных входа ничего не делает', async () => {
		useChatStore.setState({ credentials: null });

		await sendChatMessage(chat, 'Привет');

		expect(messages()).toHaveLength(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('чат из MAX слили с чатом по номеру во время отправки — подтверждение не теряется', async () => {
		// Чат из MAX (ключ — id MAX) и чат по номеру того же человека
		const maxChat: Chat = { id: '464953623', chatId: '464953623', lastMessageAt: 0 };
		store().addMessages(maxChat.id, maxChat.chatId, []);
		store().createChat('79235268075');

		const respond = replyLater();
		const sending = sendChatMessage(maxChat, 'Привет');
		// Пока идёт запрос, checkAccount связал номер с этим чатом MAX: сообщение переехало
		store().linkChat('79235268075', maxChat.id);
		respond(JSON.stringify({ idMessage: 'BAE5' }));
		await sending;

		expect(store().messages['79235268075']).toEqual([
			expect.objectContaining({ id: 'BAE5', text: 'Привет', status: 'sent' }),
		]);
	});

	it('если пользователь вышел во время отправки, не восстанавливает чат', async () => {
		const respond = replyLater();
		const sending = sendChatMessage(chat, 'Привет');

		store().logout();
		respond(JSON.stringify({ idMessage: 'BAE5' }));
		await sending;

		expect(store().chats).toEqual({});
		expect(store().messages).toEqual({});
	});
});

describe('createLocalId', () => {
	it('использует crypto.randomUUID, если он есть', () => {
		expect(createLocalId()).toMatch(/^local-[0-9a-f-]{36}$/);
	});

	// Так бывает, если приложение открыто по http с другого устройства:
	// браузер даёт crypto.randomUUID только на https и localhost
	describe('без crypto.randomUUID', () => {
		beforeEach(() => {
			vi.stubGlobal('crypto', {});
		});

		it('всё равно выдаёт разные временные id', () => {
			const ids = new Set(Array.from({ length: 100 }, () => createLocalId()));

			expect(ids.size).toBe(100);
			for (const id of ids) {
				expect(id).toMatch(/^local-/);
			}
		});

		it('отправка работает', async () => {
			reply(JSON.stringify({ idMessage: 'BAE5' }));

			await sendChatMessage(chat, 'Привет');

			expect(messages()).toEqual([expect.objectContaining({ id: 'BAE5', status: 'sent' })]);
		});
	});
});

describe('retryChatMessage', () => {
	it('повторно отправляет тот же пузырь: failed → sending → sent', async () => {
		reply('', 502);
		await sendChatMessage(chat, 'Привет');
		const failed = messages()[0];

		const respond = replyLater();
		const retrying = retryChatMessage(chat, failed);

		expect(messages()).toHaveLength(1);
		expect(messages()[0]).toMatchObject({ id: failed.id, status: 'sending' });
		expect(messages()[0].error).toBeUndefined();

		respond(JSON.stringify({ idMessage: 'BAE5' }));
		await retrying;

		expect(messages()).toEqual([
			expect.objectContaining({ id: 'BAE5', text: 'Привет', status: 'sent' }),
		]);
	});
});

describe('describeSendError', () => {
	it.each([
		[400, 'проверьте номер и длину текста'],
		[401, 'войдите заново'],
		[403, 'только сохранённым контактам'],
		[429, 'Слишком много запросов'],
		[502, 'недоступен'],
		[466, 'код 466'],
		[200, 'Неожиданный ответ сервера'],
	])('код %i', (status, text) => {
		expect(describeSendError(new ApiError(status, ''))).toContain(text);
	});

	it('таймаут — предупреждает, что сообщение могло уйти', () => {
		expect(describeSendError(new DOMException('Signal timed out', 'TimeoutError'))).toContain(
			'могло уйти',
		);
	});

	it('сеть — нет связи', () => {
		expect(describeSendError(new TypeError('Failed to fetch'))).toContain('Нет связи');
	});

	it('непонятная ошибка — общий текст', () => {
		expect(describeSendError(new Error('что-то'))).toBe('Не удалось отправить сообщение');
	});
});
