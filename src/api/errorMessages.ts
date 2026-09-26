// Распознавание ошибок, которые одинаково выглядят в любом запросе к GREEN-API.
// Используется и при входе, и при отправке сообщений.

/**
 * Запрос оборван по таймауту (AbortSignal.timeout).
 */
export function isTimeoutError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'TimeoutError';
}

/**
 * Запрос вообще не дошёл до сервера: нет интернета, неверный адрес,
 * сервер не разрешил запрос из браузера (CORS). В таких случаях fetch бросает TypeError.
 */
export function isNetworkError(error: unknown): boolean {
	return error instanceof TypeError;
}

/**
 * Текст для HTTP-кодов, которые означают одно и то же в любом запросе.
 * Возвращает null, если код нужно описать с учётом конкретного запроса.
 */
export function describeServerStatus(status: number): string | null {
	if (status === 429) {
		return 'Слишком много запросов, попробуйте через минуту';
	}
	if (status >= 500) {
		return 'Сервер GREEN-API недоступен, попробуйте позже';
	}
	return null;
}
