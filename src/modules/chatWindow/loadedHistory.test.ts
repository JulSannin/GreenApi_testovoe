import { describe, expect, it } from 'vitest';
import type { Credentials } from '@/api/types';
import { isHistoryLoaded, markHistoryLoaded } from './loadedHistory';

const login = (): Credentials => ({
	apiUrl: 'https://api.example.com',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
});

describe('loadedHistory', () => {
	it('в пределах одного входа история загружается один раз', () => {
		const credentials = login();
		expect(isHistoryLoaded(credentials, '79991234567')).toBe(false);

		markHistoryLoaded(credentials, '79991234567');

		expect(isHistoryLoaded(credentials, '79991234567')).toBe(true);
		expect(isHistoryLoaded(credentials, '79990000000')).toBe(false);
	});

	it('после выхода и нового входа (те же данные, новый объект) — загружается снова', () => {
		const first = login();
		markHistoryLoaded(first, '79991234567');

		const second = login();

		expect(isHistoryLoaded(second, '79991234567')).toBe(false);
	});
});
