import { describe, expect, it } from 'vitest';
import { AVATAR_TONES, avatarTone } from './avatarTone';

describe('avatarTone', () => {
	it('у одного ключа цвет всегда один и тот же', () => {
		expect(avatarTone('464953623')).toBe(avatarTone('464953623'));
	});

	it('номер цвета — от 1 до AVATAR_TONES, в том числе для пустой и длинной строки', () => {
		for (const key of ['', '0', '79991234567', '-300', 'x'.repeat(10_000), 'Никита 😀']) {
			const tone = avatarTone(key);
			expect(tone).toBeGreaterThanOrEqual(1);
			expect(tone).toBeLessThanOrEqual(AVATAR_TONES);
		}
	});

	it('разные ключи получают разные цвета', () => {
		const keys = Array.from({ length: 50 }, (_, i) => String(79990000000 + i));
		const tones = new Set(keys.map(avatarTone));
		expect(tones.size).toBe(AVATAR_TONES);
	});
});
