// Безопасное чтение данных, пришедших с чужого сервера.
// Каждая функция возвращает значение, только если оно нужного типа, иначе undefined (или null):
// так одна кривая запись не уронит разбор и не попадёт в стор в неожиданном виде.

import { isValidPhone } from './phone';

export type JsonObject = Record<string, unknown>;

// Объект (не null и не массив) — или undefined
export function asObject(value: unknown): JsonObject | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as JsonObject)
		: undefined;
}

// Непустая строка без пробелов по краям — или undefined (для чисел, объектов, пустых строк)
export function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

// Идентификатор: строка или конечное число (превращаем в строку)
export function asId(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	return asString(value);
}

// Текст сообщения: любая строка как есть (пробелы и переносы — часть сообщения)
export function asText(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

// Номер телефона: число или строка из цифр, похожие на настоящий номер (как в isValidPhone).
// 0 (так приходит скрытый номер) и мусор — null
export function asPhone(value: unknown): string | null {
	const digits =
		typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : asString(value);
	return digits && isValidPhone(digits) ? digits : null;
}

// Время из секунд (так его присылает GREEN-API) в миллисекунды; кривое — undefined
export function secondsToMs(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? value * 1000
		: undefined;
}
