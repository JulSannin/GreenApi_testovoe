// Тесты API-слоя. Настоящий fetch подменяется заглушкой:
// тесты не ходят в интернет, не требуют настоящего токена и всегда дают одинаковый результат.
// Каждый тест задаёт, что «ответит сервер», вызывает функцию из greenApi.ts
// и проверяет, с какими адресом и параметрами был вызван fetch и что функция вернула.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ApiError,
	deleteNotification,
	getStateInstance,
	receiveNotification,
	sendMessage,
} from './greenApi';
import type { Credentials, Notification } from './types';

// Тестовые данные входа. Слеш в конце apiUrl оставлен специально —
// заодно проверяем, что buildUrl его убирает и в адресе не появляется «//»
const credentials: Credentials = {
	apiUrl: 'https://api.example.com/',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};
// Начало адреса, общее для всех методов
const BASE = 'https://api.example.com/waInstance3100000001';

// Поддельный fetch: запоминает, с какими аргументами его вызвали, и отдаёт заранее заданный ответ
const fetchMock = vi.fn<typeof fetch>();

// Перед каждым тестом подменяем глобальный fetch на заглушку
beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

// После каждого теста очищаем историю вызовов заглушки и возвращаем настоящий fetch
afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

// «Сервер ответит» строкой body со статусом status (только на ближайший вызов fetch)
function reply(body: string, status = 200) {
	fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

// То же самое, но ответ — объект, превращённый в JSON
function replyJson(data: unknown, status = 200) {
	reply(JSON.stringify(data), status);
}

// Аргументы последнего вызова fetch: адрес и настройки запроса (метод, заголовки, тело, signal)
function lastCall() {
	const call = fetchMock.mock.lastCall;
	if (!call) throw new Error('fetch не вызывался');
	const [url, init] = call;
	return { url, init };
}

describe('sendMessage', () => {
	it('отправляет POST с chatId и текстом и возвращает idMessage', async () => {
		replyJson({ idMessage: 'BAE5F4886AD0' });

		const result = await sendMessage(credentials, '79991234567@c.us', 'Привет');

		// Функция вернула то, что прислал сервер
		expect(result).toEqual({ idMessage: 'BAE5F4886AD0' });
		// Запрос ушёл на правильный адрес, методом POST, с JSON-заголовком и нужным телом
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
		// Для sendMessage пустой ответ ненормален — ждём ошибку, а не null
		reply('');

		await expect(sendMessage(credentials, '79991234567@c.us', 'Привет')).rejects.toBeInstanceOf(
			ApiError,
		);
	});
});

describe('receiveNotification', () => {
	// Пример входящего текстового сообщения в формате из документации GREEN-API
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
		// По умолчанию receiveTimeout = 20, и у GET-запроса нет тела
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
		// Сервер может ответить и строкой "null", и пустым телом — оба случая значат «нового нет»
		reply('null');
		expect(await receiveNotification(credentials)).toBeNull();

		reply('');
		expect(await receiveNotification(credentials)).toBeNull();
	});

	it('пробрасывает signal в fetch', async () => {
		// Без этого controller.abort() не сможет оборвать висящий запрос в цикле приёма
		reply('null');
		const controller = new AbortController();

		await receiveNotification(credentials, controller.signal);

		expect(lastCall().init?.signal).toBe(controller.signal);
	});

	it('не глотает AbortError', async () => {
		// Имитируем оборванный запрос: fetch падает с AbortError.
		// Ошибка должна дойти до вызывающего кода как есть, а не превратиться в ApiError
		fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

		await expect(receiveNotification(credentials)).rejects.toMatchObject({ name: 'AbortError' });
	});
});

describe('deleteNotification', () => {
	it('делает DELETE с receiptId в пути', async () => {
		replyJson({ result: true, reason: '' });

		const result = await deleteNotification(credentials, 1234567);

		expect(result).toEqual({ result: true, reason: '' });
		// receiptId стоит в конце адреса, после токена
		const { url, init } = lastCall();
		expect(url).toBe(`${BASE}/deleteNotification/token123/1234567`);
		expect(init?.method).toBe('DELETE');
	});
});

describe('getStateInstance', () => {
	it('возвращает состояние инстанса', async () => {
		// Сервер отвечает объектом, функция отдаёт наружу только строку состояния
		replyJson({ stateInstance: 'authorized' });

		expect(await getStateInstance(credentials)).toBe('authorized');
		expect(lastCall().url).toBe(`${BASE}/getStateInstance/token123`);
	});

	it('бросает ApiError со статусом и текстом ответа при ошибке', async () => {
		// Например, неверный токен — сервер отвечает 401
		reply('Unauthorized', 401);

		// Ловим ошибку в переменную, чтобы проверить и её тип, и поля
		const error = await getStateInstance(credentials).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 401, message: 'Unauthorized' });
	});

	it('бросает ApiError, если вместо JSON пришёл HTML', async () => {
		// Так бывает, если запрос ушёл не туда и сервер вернул страницу сайта
		reply('<!doctype html><html></html>');

		const error = await getStateInstance(credentials).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 200 });
	});
});

describe('адрес запроса', () => {
	it('дописывает https://, если в apiUrl нет протокола', async () => {
		replyJson({ stateInstance: 'authorized' });

		await getStateInstance({ ...credentials, apiUrl: 'api.example.com' });

		expect(lastCall().url).toBe(`${BASE}/getStateInstance/token123`);
	});

	it('не трогает apiUrl, в котором протокол уже есть', async () => {
		replyJson({ stateInstance: 'authorized' });

		await getStateInstance({ ...credentials, apiUrl: 'http://localhost:3000' });

		expect(lastCall().url).toBe(
			'http://localhost:3000/waInstance3100000001/getStateInstance/token123',
		);
	});

	it('обрезает пробелы и переносы строк в данных входа', async () => {
		replyJson({ stateInstance: 'authorized' });

		await getStateInstance({
			apiUrl: '  https://api.example.com/  ',
			idInstance: ' 3100000001 ',
			apiTokenInstance: 'token123\n',
		});

		expect(lastCall().url).toBe(`${BASE}/getStateInstance/token123`);
	});
});
