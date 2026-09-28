import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone, toChatId } from './phone';

describe('normalizePhone', () => {
	it('оставляет только цифры', () => {
		expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
		expect(normalizePhone(' 7 999 123 45 67 ')).toBe('79991234567');
	});

	it('переводит российский номер с 8 в формат с 7', () => {
		expect(normalizePhone('8 (999) 123-45-67')).toBe('79991234567');
	});

	it('не трогает 8 в начале, если номер не из 11 цифр', () => {
		// Например, иностранный номер, который начинается с 8
		expect(normalizePhone('+886 912 345 678')).toBe('886912345678');
	});

	it('номер с «+» не переделывает в российский — код страны уже указан', () => {
		// 11 цифр на 8: Вьетнам (+84) и Япония (+81), а не российский номер через 8
		expect(normalizePhone('+84 912 345 678')).toBe('84912345678');
		expect(normalizePhone(' +81 3 1234 5678')).toBe('81312345678');
		// 10 цифр на 9 — тоже не российский мобильный без кода
		expect(normalizePhone('+95 9 123 4567')).toBe('9591234567');
	});

	it('добавляет 7 к российскому мобильному без кода страны', () => {
		expect(normalizePhone('999 123-45-67')).toBe('79991234567');
	});

	it('не добавляет 7 к номеру из 10 цифр, который начинается не с 9', () => {
		// Например, городской номер без кода — его отклонит isValidPhone
		expect(normalizePhone('495 123-45-67')).toBe('4951234567');
	});

	it('возвращает пустую строку, если цифр нет', () => {
		expect(normalizePhone('')).toBe('');
		expect(normalizePhone('abc')).toBe('');
	});
});

describe('isValidPhone', () => {
	it('принимает номер от 11 до 15 цифр', () => {
		expect(isValidPhone('79991234567')).toBe(true);
		expect(isValidPhone('375291234567')).toBe(true);
		expect(isValidPhone('123456789012345')).toBe(true);
	});

	it('отклоняет номер без кода страны, слишком длинный и пустой', () => {
		expect(isValidPhone('4951234567')).toBe(false);
		expect(isValidPhone('1234567890123456')).toBe(false);
		expect(isValidPhone('')).toBe(false);
	});

	it('отклоняет номер не из одних цифр — его сначала нужно нормализовать', () => {
		expect(isValidPhone('+79991234567')).toBe(false);
	});
});

describe('toChatId', () => {
	it('добавляет суффикс @c.us', () => {
		expect(toChatId('79991234567')).toBe('79991234567@c.us');
	});
});
