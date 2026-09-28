// Тесты проверки данных входа. Как и в тестах API, настоящий fetch подменяется заглушкой,
// а каждый тест задаёт, что «ответит сервер», и проверяет, какое сообщение увидит пользователь.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_RETRIES } from '@/api/greenApi';
import type { Credentials, StateInstance } from '@/api/types';
import { checkCredentials, LoginError, validateCredentials } from './checkCredentials';

const credentials: Credentials = {
	apiUrl: 'https://api.example.com',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

// «Сервер ответит» строкой body со статусом status
function reply(body: string, status = 200) {
	fetchMock.mockResolvedValueOnce(new Response(body, { status }));
}

// Сервер ответит, что инстанс в состоянии state
function replyState(state: string) {
	reply(JSON.stringify({ stateInstance: state }));
}

describe('validateCredentials', () => {
	it('пропускает заполненные поля', () => {
		expect(validateCredentials(credentials)).toBeNull();
	});

	it.each<keyof Credentials>(['idInstance', 'apiTokenInstance'])(
		'требует заполнить поле %s',
		(field) => {
			expect(validateCredentials({ ...credentials, [field]: '' })).toBe('Заполните оба поля');
		},
	);

	it('требует, чтобы idInstance состоял только из цифр', () => {
		expect(validateCredentials({ ...credentials, idInstance: '3100abc' })).toBe(
			'idInstance должен состоять только из цифр',
		);
	});
});

describe('checkCredentials', () => {
	it('пропускает авторизованный инстанс', async () => {
		replyState('authorized');

		await expect(checkCredentials(credentials)).resolves.toBeUndefined();
	});

	it('передаёт в запрос сигнал с таймаутом', async () => {
		replyState('authorized');

		await checkCredentials(credentials);

		expect(fetchMock.mock.lastCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
	});

	// it.each запускает один и тот же тест для каждой строки таблицы
	it.each<[StateInstance, string]>([
		['notAuthorized', 'Инстанс не авторизован'],
		['pendingPassword', 'введите пароль'],
		['starting', 'Инстанс запускается'],
		['blocked', 'заблокирован'],
		['suspended', 'временные ограничения'],
	])('не пускает инстанс в состоянии %s', async (state, text) => {
		replyState(state);

		const error = await checkCredentials(credentials).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(LoginError);
		expect((error as LoginError).message).toContain(text);
	});

	it('не пускает инстанс в неизвестном состоянии', async () => {
		replyState('somethingNew');

		await expect(checkCredentials(credentials)).rejects.toThrow('«somethingNew»');
	});
});

describe('ошибки запроса', () => {
	it.each([400, 401, 403, 404])('статус %i — неверные данные', async (status) => {
		reply('', status);

		await expect(checkCredentials(credentials)).rejects.toThrow('Неверные данные');
	});

	it('статус 429 и после всех повторов — слишком много запросов', async () => {
		// API-слой повторяет запрос после 429 с паузами — не ждём их по-настоящему
		vi.useFakeTimers();
		try {
			for (let i = 0; i <= RATE_LIMIT_RETRIES; i++) {
				reply('', 429);
			}

			const checking = checkCredentials(credentials).catch((e: unknown) => e);
			await vi.runAllTimersAsync();

			expect(await checking).toMatchObject({ message: expect.stringContaining('Слишком много') });
		} finally {
			vi.useRealTimers();
		}
	});

	it('статус 5xx — сервер недоступен', async () => {
		reply('', 502);

		await expect(checkCredentials(credentials)).rejects.toThrow('Сервер GREEN-API недоступен');
	});

	it('ответ не JSON — неожиданный ответ сервера', async () => {
		reply('<!doctype html><html></html>');

		await expect(checkCredentials(credentials)).rejects.toThrow('Неожиданный ответ сервера');
	});

	it('другой код ошибки — показывает его, а не винит данные входа', async () => {
		reply('', 466);

		await expect(checkCredentials(credentials)).rejects.toThrow(
			'Ошибка сервера GREEN-API (код 466)',
		);
	});

	it('таймаут — сервер не отвечает', async () => {
		fetchMock.mockRejectedValueOnce(new DOMException('Signal timed out', 'TimeoutError'));

		await expect(checkCredentials(credentials)).rejects.toThrow('Сервер не отвечает');
	});

	it('запрос не дошёл до сервера — не удалось связаться', async () => {
		// Так fetch сообщает о проблемах сети, неверном адресе или CORS
		fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(checkCredentials(credentials)).rejects.toThrow('Не удалось связаться с сервером');
	});

	it('все ошибки превращаются в LoginError', async () => {
		fetchMock.mockRejectedValueOnce(new Error('что-то непонятное'));

		await expect(checkCredentials(credentials)).rejects.toBeInstanceOf(LoginError);
	});

	it('не просит проверить apiUrl — его пользователь не вводит', async () => {
		const failures = [
			() => reply('', 401),
			() => reply('<!doctype html><html></html>'),
			() => fetchMock.mockRejectedValueOnce(new DOMException('Signal timed out', 'TimeoutError')),
			() => fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')),
		];
		for (const fail of failures) {
			fail();
			const error = await checkCredentials(credentials).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(LoginError);
			expect((error as LoginError).message).not.toContain('apiUrl');
		}
	});
});
