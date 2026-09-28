import { describe, expect, it } from 'vitest';
import { asId, asObject, asPhone, asString, asText, secondsToMs } from './json';

describe('asObject', () => {
	it('объект — как есть, остальное — undefined', () => {
		expect(asObject({ a: 1 })).toEqual({ a: 1 });
		for (const value of [null, undefined, 'строка', 1, [1, 2]]) {
			expect(asObject(value)).toBeUndefined();
		}
	});
});

describe('asString', () => {
	it('обрезает пробелы; пустая строка и не строки — undefined', () => {
		expect(asString('  Иван ')).toBe('Иван');
		for (const value of ['', '   ', 1, null, {}]) {
			expect(asString(value)).toBeUndefined();
		}
	});
});

describe('asId', () => {
	it('строка или число', () => {
		expect(asId('10000000')).toBe('10000000');
		expect(asId(10000000)).toBe('10000000');
		expect(asId(NaN)).toBeUndefined();
		expect(asId({})).toBeUndefined();
	});
});

describe('asText', () => {
	it('любая строка как есть, не строка — undefined', () => {
		expect(asText('  привет\n')).toBe('  привет\n');
		expect(asText({ html: 'привет' })).toBeUndefined();
	});
});

describe('asPhone', () => {
	it('номер числом или строкой из цифр', () => {
		expect(asPhone(79876543210)).toBe('79876543210');
		expect(asPhone('79876543210')).toBe('79876543210');
	});

	it('скрытый номер (0), дробь, мусор — null', () => {
		for (const value of [0, 12.5, 'скрыт', '123', undefined]) {
			expect(asPhone(value)).toBeNull();
		}
	});
});

describe('secondsToMs', () => {
	it('переводит секунды в миллисекунды; кривое время — undefined', () => {
		expect(secondsToMs(1763115112)).toBe(1763115112000);
		for (const value of [0, -1, NaN, '1763115112', undefined]) {
			expect(secondsToMs(value)).toBeUndefined();
		}
	});

	it('время, которое не умеет Date, — тоже undefined: иначе упало бы форматирование', () => {
		expect(secondsToMs(1e13)).toBeUndefined();
		expect(secondsToMs(Infinity)).toBeUndefined();
		// Граница: самая поздняя допустимая дата ещё проходит
		expect(secondsToMs(8.64e12)).toBe(8.64e15);
		expect(() => new Date(secondsToMs(8.64e12)!).toISOString()).not.toThrow();
	});
});
