// Выбор цвета аватара по ключу (например, id чата): у одного ключа цвет всегда один и тот же,
// а разные ключи распределяются по всем цветам.

// Сколько градиентов у аватара: --avatar-gradient-1…5 в theme.css и классы tone1…tone5 в Avatar.module.css
export const AVATAR_TONES = 5;

/**
 * Номер цвета от 1 до AVATAR_TONES. Хеш строки — как String.hashCode в Java:
 * каждый символ умножает накопленное на 31 и добавляет свой код.
 */
export function avatarTone(key: string): number {
	let hash = 0;
	for (const char of key) {
		// | 0 — держим число в пределах 32 бит, иначе на длинной строке точность потеряется
		hash = (hash * 31 + char.codePointAt(0)!) | 0;
	}
	return (Math.abs(hash) % AVATAR_TONES) + 1;
}
