import { describe, expect, it } from 'vitest';
import { parseCheckAccount } from './parseCheckAccount';

describe('parseCheckAccount', () => {
	it('аккаунт есть — id чата в MAX', () => {
		expect(parseCheckAccount({ exist: true, chatId: '10000000', fromCache: true })).toEqual({
			exist: true,
			chatId: '10000000',
		});
	});

	it('аккаунта нет', () => {
		expect(parseCheckAccount({ exist: false })).toEqual({ exist: false, chatId: undefined });
	});

	it('id числом — строкой', () => {
		expect(parseCheckAccount({ exist: true, chatId: 10000000 })?.chatId).toBe('10000000');
	});

	it('ответ не понять — null', () => {
		expect(parseCheckAccount(null)).toBeNull();
		expect(parseCheckAccount({ exist: 'yes' })).toBeNull();
		expect(parseCheckAccount([])).toBeNull();
	});
});
