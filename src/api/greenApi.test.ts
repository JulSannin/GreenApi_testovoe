import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ApiError,
	deleteNotification,
	getStateInstance,
	receiveNotification,
	sendMessage,
} from './greenApi';
import type { Credentials, Notification } from './types';

const credentials: Credentials = {
	apiUrl: 'https://api.example.com/',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};
const BASE = 'https://api.example.com/waInstance3100000001';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

function reply(body: string, status = 200) {
	fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

function replyJson(data: unknown, status = 200) {
	reply(JSON.stringify(data), status);
}

function lastCall() {
	const [url, init] = fetchMock.mock.calls[0];
	return { url, init };
}

describe('sendMessage', () => {
	it('отправляет POST с chatId и текстом и возвращает idMessage', async () => {
		replyJson({ idMessage: 'BAE5F4886AD0' });

		const result = await sendMessage(credentials, '79991234567@c.us', 'Привет');

		expect(result).toEqual({ idMessage: 'BAE5F4886AD0' });
		const { url, init } = lastCall();
		expect(url).toBe(`${BASE}/sendMessage/token123`);
		expect(init?.method).toBe('POST');
		expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(JSON.parse(init?.body as string)).toEqual({
			chatId: '79991234567@c.us',
			message: 'Привет',
		});
	});

	it('бросает ApiError на пустой ответ', async () => {
		reply('');

		await expect(sendMessage(credentials, '79991234567@c.us', 'Привет')).rejects.toBeInstanceOf(
			ApiError,
		);
	});
});

describe('receiveNotification', () => {
	const notification: Notification = {
		receiptId: 1234567,
		body: {
			typeWebhook: 'incomingMessageReceived',
			timestamp: 1763115112,
			idMessage: '126543123451133331119',
			senderData: { chatId: '10000000', sender: '10000000', senderPhoneNumber: 79876543210 },
			messageData: {
				typeMessage: 'textMessage',
				textMessageData: { textMessage: 'Привет от Green-API!' },
			},
		},
	};

	it('делает GET с receiveTimeout и возвращает уведомление', async () => {
		replyJson(notification);

		const result = await receiveNotification(credentials);

		expect(result).toEqual(notification);
		const { url, init } = lastCall();
		expect(url).toBe(`${BASE}/receiveNotification/token123?receiveTimeout=20`);
		expect(init?.method).toBe('GET');
		expect(init?.body).toBeUndefined();
	});

	it('передаёт свой receiveTimeout', async () => {
		reply('null');

		await receiveNotification(credentials, undefined, 5);

		expect(lastCall().url).toBe(`${BASE}/receiveNotification/token123?receiveTimeout=5`);
	});

	it('возвращает null, когда очередь пуста', async () => {
		reply('null');
		expect(await receiveNotification(credentials)).toBeNull();

		reply('');
		expect(await receiveNotification(credentials)).toBeNull();
	});

	it('пробрасывает signal в fetch', async () => {
		reply('null');
		const controller = new AbortController();

		await receiveNotification(credentials, controller.signal);

		expect(lastCall().init?.signal).toBe(controller.signal);
	});

	it('не глотает AbortError', async () => {
		fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

		await expect(receiveNotification(credentials)).rejects.toMatchObject({ name: 'AbortError' });
	});
});

describe('deleteNotification', () => {
	it('делает DELETE с receiptId в пути', async () => {
		replyJson({ result: true, reason: '' });

		const result = await deleteNotification(credentials, 1234567);

		expect(result).toEqual({ result: true, reason: '' });
		const { url, init } = lastCall();
		expect(url).toBe(`${BASE}/deleteNotification/token123/1234567`);
		expect(init?.method).toBe('DELETE');
	});
});

describe('getStateInstance', () => {
	it('возвращает состояние инстанса', async () => {
		replyJson({ stateInstance: 'authorized' });

		expect(await getStateInstance(credentials)).toBe('authorized');
		expect(lastCall().url).toBe(`${BASE}/getStateInstance/token123`);
	});

	it('бросает ApiError со статусом и текстом ответа при ошибке', async () => {
		reply('Unauthorized', 401);

		const error = await getStateInstance(credentials).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 401, message: 'Unauthorized' });
	});
});
