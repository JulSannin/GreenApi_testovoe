// Тесты цикла приёма. fetch подменяется заглушкой, которая отвечает по очереди,
// как сервер GREEN-API; последний «ответ» останавливает цикл, иначе он крутился бы вечно.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credentials, WebhookBody } from '@/api/types';
import {
	createRetryWaiter,
	retryDelay,
	runNotificationLoop,
	type LoopStatus,
} from './runNotificationLoop';

// Чтобы проверить подстраховку в цикле, разбор можно заставить упасть один раз —
// как если бы в parseNotification нашлась ошибка. В остальных тестах разбор настоящий
const parser = vi.hoisted(() => ({ crashNext: false }));
vi.mock('./parseNotification', async (importOriginal) => {
	const original = await importOriginal<typeof import('./parseNotification')>();
	return {
		...original,
		parseNotification: (...args: Parameters<typeof original.parseNotification>) => {
			if (parser.crashNext) {
				parser.crashNext = false;
				throw new Error('Ошибка в разборе');
			}
			return original.parseNotification(...args);
		},
	};
});

const credentials: Credentials = {
	apiUrl: 'https://api.example.com',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};

const incomingText: WebhookBody = {
	typeWebhook: 'incomingMessageReceived',
	timestamp: 1763115112,
	idMessage: 'MSG-1',
	senderData: {
		chatId: '10000000',
		chatType: 'user',
		sender: '10000000',
		senderPhoneNumber: 79876543210,
	},
	messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет' } },
};

const fetchMock = vi.fn<typeof fetch>();
let controller: AbortController;

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
	controller = new AbortController();
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

// Ответы «сервера» по порядку
const json =
	(data: unknown, status = 200) =>
	() =>
		Promise.resolve(new Response(JSON.stringify(data), { status }));
const empty = () => Promise.resolve(new Response('null'));
const fail = (error: unknown) => () => Promise.reject(error);
// Последний ответ: останавливаем цикл, как это делает выход с экрана
const stop = () => {
	controller.abort();
	return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
};

function serverReplies(...replies: (() => Promise<Response>)[]) {
	for (const reply of replies) {
		fetchMock.mockImplementationOnce(reply);
	}
}

// Запускает цикл и собирает всё, что он сообщил наружу
async function run() {
	const onMessage = vi.fn();
	const statuses: LoopStatus[] = [];
	const waits: number[] = [];

	await runNotificationLoop({
		credentials,
		signal: controller.signal,
		onMessage,
		onStatus: (status) => statuses.push(status),
		// Не ждём по-настоящему, только запоминаем длительность паузы
		wait: async (ms) => {
			waits.push(ms);
		},
	});

	const urls = fetchMock.mock.calls.map(([url]) => String(url));
	return { onMessage, statuses, waits, urls };
}

describe('runNotificationLoop', () => {
	it('входящее сообщение: передаёт в onMessage и удаляет уведомление из очереди', async () => {
		serverReplies(
			json({ receiptId: 7, body: incomingText }),
			json({ result: true, reason: '' }),
			stop,
		);

		const { onMessage, urls } = await run();

		expect(onMessage).toHaveBeenCalledTimes(1);
		expect(onMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				chatKey: '79876543210',
				message: expect.objectContaining({ id: 'MSG-1', text: 'Привет', direction: 'in' }),
			}),
		);
		expect(urls[0]).toContain('/receiveNotification/token123?receiveTimeout=20');
		expect(urls[1]).toContain('/deleteNotification/token123/7');
	});

	it('ненужное уведомление (наше же исходящее) не показывает, но удаляет', async () => {
		serverReplies(
			json({ receiptId: 8, body: { ...incomingText, typeWebhook: 'outgoingAPIMessageReceived' } }),
			json({ result: true, reason: '' }),
			stop,
		);

		const { onMessage, urls } = await run();

		expect(onMessage).not.toHaveBeenCalled();
		expect(urls[1]).toContain('/deleteNotification/token123/8');
	});

	it('пустая очередь: ничего не удаляет; мгновенный пустой ответ — пауза 1 с', async () => {
		// Настоящий сервер держит запрос до 20 с. Если он ответил сразу,
		// без паузы цикл закидал бы его запросами
		serverReplies(empty, empty, stop);

		const { urls, waits } = await run();

		expect(urls).toHaveLength(3);
		expect(urls.every((url) => url.includes('/receiveNotification/'))).toBe(true);
		expect(waits).toEqual([1000, 1000]);
	});

	it('ответы 408 — как пустая очередь: без плашки и без растущей паузы', async () => {
		serverReplies(json(null, 408), json(null, 408), json(null, 408), stop);

		const { statuses, waits, urls } = await run();

		expect(statuses).toEqual([]);
		// Мгновенный ответ — пауза 1 с, как у пустой очереди, а не 3, 6, 12 с, как у сбоя
		expect(waits).toEqual([1000, 1000, 1000]);
		expect(urls).toHaveLength(4);
	});

	it('сбой сети: пауза растёт, плашка — со второй неудачи, после успеха — убирается', async () => {
		serverReplies(
			fail(new TypeError('Failed to fetch')),
			fail(new TypeError('Failed to fetch')),
			empty,
			stop,
		);

		const { waits, statuses } = await run();

		// 3 и 6 с — после неудач, 1 с — после мгновенного пустого ответа
		expect(waits).toEqual([3000, 6000, 1000]);
		expect(statuses).toEqual([
			{ kind: 'retrying', message: expect.stringContaining('Нет связи с сервером') },
			{ kind: 'ok' },
		]);
	});

	it('одна неудача — без плашки', async () => {
		serverReplies(fail(new TypeError('Failed to fetch')), empty, stop);

		const { statuses, waits } = await run();

		expect(waits).toEqual([3000, 1000]);
		expect(statuses).toEqual([]);
	});

	it('401: сообщает, что нужен новый вход, и останавливается', async () => {
		serverReplies(json(null, 401));

		const { statuses, waits, urls } = await run();

		expect(statuses).toEqual([{ kind: 'unauthorized' }]);
		expect(waits).toEqual([]);
		expect(urls).toHaveLength(1);
	});

	it('400: подсказывает проверить webhookUrl в настройках инстанса', async () => {
		serverReplies(json(null, 400), json(null, 400), stop);

		const { statuses } = await run();

		expect(statuses[0]).toEqual({
			kind: 'retrying',
			message: expect.stringContaining('webhookUrl'),
		});
	});

	it('не удалось удалить уведомление — продолжает работу; повтор отсечёт стор', async () => {
		serverReplies(
			json({ receiptId: 9, body: incomingText }),
			fail(new TypeError('Failed to fetch')),
			json({ receiptId: 9, body: incomingText }),
			json({ result: true, reason: '' }),
			stop,
		);

		const { onMessage, waits } = await run();

		expect(onMessage).toHaveBeenCalledTimes(2);
		expect(waits).toEqual([3000]);
	});

	it('уведомление неожиданного вида пропускается и удаляется — очередь не встаёт', async () => {
		const withoutChatId = {
			...incomingText,
			idMessage: 'BROKEN',
			senderData: { sender: '1' },
		};
		serverReplies(
			json({ receiptId: 10, body: withoutChatId }),
			json({ result: true, reason: '' }),
			json({ receiptId: 11, body: incomingText }),
			json({ result: true, reason: '' }),
			stop,
		);

		const { onMessage, urls, waits, statuses } = await run();

		// Следующее, нормальное сообщение дошло
		expect(onMessage).toHaveBeenCalledTimes(1);
		expect(onMessage).toHaveBeenCalledWith(
			expect.objectContaining({ message: expect.objectContaining({ id: 'MSG-1' }) }),
		);
		expect(urls.filter((url) => url.includes('/deleteNotification/'))).toHaveLength(2);
		expect(waits).toEqual([]);
		expect(statuses).toEqual([]);
	});

	it('если разбор упал из-за ошибки в нашем коде — уведомление удаляется', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		parser.crashNext = true;
		serverReplies(
			json({ receiptId: 12, body: incomingText }),
			json({ result: true, reason: '' }),
			json({ receiptId: 13, body: { ...incomingText, idMessage: 'MSG-2' } }),
			json({ result: true, reason: '' }),
			stop,
		);

		const { onMessage, urls, waits } = await run();

		expect(onMessage).toHaveBeenCalledTimes(1);
		expect(onMessage).toHaveBeenCalledWith(
			expect.objectContaining({ message: expect.objectContaining({ id: 'MSG-2' }) }),
		);
		expect(urls[1]).toContain('/deleteNotification/token123/12');
		expect(waits).toEqual([]);
		expect(consoleError).toHaveBeenCalled();
		consoleError.mockRestore();
	});

	it('ответ пришёл, когда цикл уже остановили: не обрабатывает и не удаляет', async () => {
		// Сервер ответил уведомлением, но пользователь в тот же миг вышел
		fetchMock.mockImplementationOnce(() => {
			controller.abort();
			return Promise.resolve(new Response(JSON.stringify({ receiptId: 14, body: incomingText })));
		});

		const { onMessage, urls } = await run();

		expect(onMessage).not.toHaveBeenCalled();
		expect(urls).toHaveLength(1);
	});

	it('каждый запрос получает сигнал с таймаутом, а не только сигнал остановки', async () => {
		serverReplies(empty, stop);

		await run();

		const signal = fetchMock.mock.calls[0][1]?.signal;
		expect(signal).toBeInstanceOf(AbortSignal);
		expect(signal).not.toBe(controller.signal);
	});

	it('работает в браузерах без AbortSignal.any (Safari < 17.4, Chrome < 116, Firefox < 124)', async () => {
		const original = AbortSignal.any;
		Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true });
		try {
			serverReplies(
				json({ receiptId: 7, body: incomingText }),
				json({ result: true, reason: '' }),
				stop,
			);

			const { onMessage, statuses } = await run();

			expect(onMessage).toHaveBeenCalledTimes(1);
			expect(statuses).toEqual([]);
		} finally {
			Object.defineProperty(AbortSignal, 'any', { value: original, configurable: true });
		}
	});

	it('зависший запрос обрывается через 30 с как таймаут и считается сбоем', async () => {
		vi.useFakeTimers();
		let abortReason: unknown;
		// Сервер не отвечает, пока запрос не оборвут
		fetchMock.mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						abortReason = init.signal?.reason;
						reject(abortReason);
					});
				}),
		);
		serverReplies(stop);

		const running = run();
		await vi.advanceTimersByTimeAsync(30_000);
		const { waits } = await running;

		expect(abortReason).toMatchObject({ name: 'TimeoutError' });
		expect(waits).toEqual([3000]);
	});

	it('после запросов не оставляет обработчиков на сигнале остановки', async () => {
		const added = vi.spyOn(controller.signal, 'addEventListener');
		const removed = vi.spyOn(controller.signal, 'removeEventListener');
		serverReplies(
			json({ receiptId: 7, body: incomingText }),
			json({ result: true, reason: '' }),
			empty,
			stop,
		);

		await run();

		expect(added.mock.calls.length).toBeGreaterThan(0);
		expect(removed.mock.calls.length).toBe(added.mock.calls.length);
	});
});

describe('retryDelay', () => {
	it('растёт вдвое и не превышает 30 секунд', () => {
		expect([1, 2, 3, 4, 5, 10].map(retryDelay)).toEqual([3000, 6000, 12000, 24000, 30000, 30000]);
	});
});

describe('createRetryWaiter', () => {
	// Вместо браузерных window и document — простые объекты, которые умеют рассылать события
	let fakeWindow: EventTarget;
	let fakeDocument: EventTarget & { visibilityState: DocumentVisibilityState };

	beforeEach(() => {
		vi.useFakeTimers();
		fakeWindow = new EventTarget();
		fakeDocument = Object.assign(new EventTarget(), {
			visibilityState: 'visible' as DocumentVisibilityState,
		});
		vi.stubGlobal('window', fakeWindow);
		vi.stubGlobal('document', fakeDocument);
	});

	// Запускает паузу и позволяет проверить, закончилась ли она
	function startWait(waiter: ReturnType<typeof createRetryWaiter>, ms: number) {
		const state = { done: false };
		void waiter.wait(ms).then(() => {
			state.done = true;
		});
		return state;
	}

	it('ждёт указанное время', async () => {
		const waiter = createRetryWaiter(controller.signal);
		const pause = startWait(waiter, 3000);

		await vi.advanceTimersByTimeAsync(2999);
		expect(pause.done).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(pause.done).toBe(true);
	});

	it('заканчивается сразу, когда появилась сеть', async () => {
		const waiter = createRetryWaiter(controller.signal);
		const pause = startWait(waiter, 30_000);

		fakeWindow.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);

		expect(pause.done).toBe(true);
	});

	it('заканчивается, когда вкладка снова видна, но не когда её скрыли', async () => {
		const waiter = createRetryWaiter(controller.signal);
		const pause = startWait(waiter, 30_000);

		fakeDocument.visibilityState = 'hidden';
		fakeDocument.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(pause.done).toBe(false);

		fakeDocument.visibilityState = 'visible';
		fakeDocument.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(0);
		expect(pause.done).toBe(true);
	});

	it('если сеть вернулась ещё во время запроса — пропускает одну следующую паузу', async () => {
		const waiter = createRetryWaiter(controller.signal);

		fakeWindow.dispatchEvent(new Event('online'));
		const first = startWait(waiter, 30_000);
		await vi.advanceTimersByTimeAsync(0);
		expect(first.done).toBe(true);

		// Только одну: следующая пауза — снова полная
		const second = startWait(waiter, 3000);
		await vi.advanceTimersByTimeAsync(0);
		expect(second.done).toBe(false);
	});

	it('заканчивается сразу, если цикл остановили, и снимает обработчик с сигнала', async () => {
		const removed = vi.spyOn(controller.signal, 'removeEventListener');
		const waiter = createRetryWaiter(controller.signal);
		const pause = startWait(waiter, 30_000);

		controller.abort();
		await vi.advanceTimersByTimeAsync(0);

		expect(pause.done).toBe(true);
		expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
	});

	it('после паузы, закончившейся по времени, не оставляет обработчик на сигнале', async () => {
		const added = vi.spyOn(controller.signal, 'addEventListener');
		const removed = vi.spyOn(controller.signal, 'removeEventListener');
		const waiter = createRetryWaiter(controller.signal);

		startWait(waiter, 3000);
		await vi.advanceTimersByTimeAsync(3000);

		expect(removed.mock.calls.length).toBe(added.mock.calls.length);
	});

	it('dispose снимает обработчики online и visibilitychange', () => {
		const removedFromWindow = vi.spyOn(fakeWindow, 'removeEventListener');
		const removedFromDocument = vi.spyOn(fakeDocument, 'removeEventListener');
		const waiter = createRetryWaiter(controller.signal);

		waiter.dispose();

		expect(removedFromWindow).toHaveBeenCalledWith('online', expect.any(Function));
		expect(removedFromDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
	});

	it('цикл без своей паузы снимает эти обработчики, когда заканчивается', async () => {
		const removedFromWindow = vi.spyOn(fakeWindow, 'removeEventListener');
		serverReplies(json(null, 401));

		await runNotificationLoop({
			credentials,
			signal: controller.signal,
			onMessage: vi.fn(),
			onStatus: vi.fn(),
		});

		expect(removedFromWindow).toHaveBeenCalledWith('online', expect.any(Function));
	});

	it('без window и document (как в Node) — обычная пауза', async () => {
		vi.unstubAllGlobals();
		const waiter = createRetryWaiter(controller.signal);
		const pause = startWait(waiter, 1000);

		await vi.advanceTimersByTimeAsync(1000);

		expect(pause.done).toBe(true);
	});
});
