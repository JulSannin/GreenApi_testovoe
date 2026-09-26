import { describe, expect, it } from 'vitest';
import { describeServerStatus, isNetworkError, isTimeoutError } from './errorMessages';

describe('isTimeoutError', () => {
	it('узнаёт ошибку таймаута', () => {
		expect(isTimeoutError(new DOMException('Signal timed out', 'TimeoutError'))).toBe(true);
	});

	it('не путает с обычной отменой запроса', () => {
		expect(isTimeoutError(new DOMException('Aborted', 'AbortError'))).toBe(false);
	});
});

describe('isNetworkError', () => {
	it('узнаёт ошибку сети от fetch', () => {
		expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
	});

	it('не считает сетевой любую другую ошибку', () => {
		expect(isNetworkError(new Error('что-то'))).toBe(false);
	});
});

describe('describeServerStatus', () => {
	it('описывает 429 и 5xx', () => {
		expect(describeServerStatus(429)).toContain('Слишком много запросов');
		expect(describeServerStatus(500)).toContain('недоступен');
		expect(describeServerStatus(503)).toContain('недоступен');
	});

	it('для остальных кодов возвращает null', () => {
		expect(describeServerStatus(400)).toBeNull();
		expect(describeServerStatus(401)).toBeNull();
		expect(describeServerStatus(466)).toBeNull();
	});
});
