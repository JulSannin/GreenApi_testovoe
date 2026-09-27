import { describe, expect, it } from 'vitest';
import {
	findSettingsProblem,
	forgetSettingsSaved,
	isApplyingSettings,
	rememberSettingsSaved,
	SETTINGS_APPLY_MS,
} from './instanceSettings';

// Простое хранилище в памяти вместо localStorage
function memoryStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
	};
}

describe('настройки сохранены и применяются', () => {
	const NOW = 1_800_000_000_000;

	it('5 минут после сохранения — «применяются», потом — нет', () => {
		const storage = memoryStorage();
		rememberSettingsSaved(storage, '3100000001', NOW);

		expect(isApplyingSettings(storage, '3100000001', NOW + 60_000)).toBe(true);
		expect(isApplyingSettings(storage, '3100000001', NOW + SETTINGS_APPLY_MS)).toBe(false);
	});

	it('помнит отдельно для каждого инстанса', () => {
		const storage = memoryStorage();
		rememberSettingsSaved(storage, '3100000001', NOW);

		expect(isApplyingSettings(storage, '3100000002', NOW)).toBe(false);
	});

	it('forgetSettingsSaved стирает пометку', () => {
		const storage = memoryStorage();
		rememberSettingsSaved(storage, '3100000001', NOW);

		forgetSettingsSaved(storage, '3100000001');

		expect(isApplyingSettings(storage, '3100000001', NOW)).toBe(false);
	});

	it('без хранилища или если оно бросает ошибки — не падает', () => {
		const broken = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {
				throw new Error('SecurityError');
			},
		};

		expect(() => rememberSettingsSaved(broken, '1', NOW)).not.toThrow();
		expect(isApplyingSettings(broken, '1', NOW)).toBe(false);
		expect(() => forgetSettingsSaved(broken, '1')).not.toThrow();
		expect(isApplyingSettings(null, '1', NOW)).toBe(false);
	});
});

describe('findSettingsProblem', () => {
	it('всё включено и адрес пустой — проблем нет', () => {
		expect(findSettingsProblem({ webhookUrl: '', incomingWebhook: 'yes' })).toBeNull();
	});

	it('уведомления о входящих выключены (так по умолчанию у нового инстанса)', () => {
		expect(findSettingsProblem({ webhookUrl: '', incomingWebhook: 'no' })).toEqual({
			kind: 'incomingOff',
		});
	});

	it('указан адрес для уведомлений — важнее, чем выключенные входящие', () => {
		expect(
			findSettingsProblem({ webhookUrl: ' https://example.com/hook ', incomingWebhook: 'no' }),
		).toEqual({ kind: 'webhookUrl', url: 'https://example.com/hook' });
	});

	it('по ответу не понять — промолчать', () => {
		expect(findSettingsProblem(null)).toBeNull();
		expect(findSettingsProblem('ошибка')).toBeNull();
		expect(findSettingsProblem({ webhookUrl: '' })).toBeNull();
	});
});
