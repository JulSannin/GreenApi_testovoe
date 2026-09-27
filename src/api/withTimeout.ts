/**
 * Выполняет запрос с сигналом, который обрывается и по signal (компонент ушёл с экрана,
 * цикл приёма остановлен), и сам через ms миллисекунд — на случай, когда сеть «повисла»
 * и запрос не заканчивается. После запроса таймер и обработчик на signal снимаются:
 * цикл приёма живёт часами, и без уборки они копились бы на каждом запросе.
 * (AbortSignal.any сделал бы то же одной строкой, но его нет в Safari < 17.4,
 * Chrome < 116 и Firefox < 124, а проект собирается и для них)
 */
export async function withTimeout<T>(
	signal: AbortSignal,
	ms: number,
	request: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const controller = new AbortController();
	const stop = () => controller.abort(signal.reason);
	if (signal.aborted) {
		stop();
	} else {
		signal.addEventListener('abort', stop);
	}
	// Причина — TimeoutError, как у AbortSignal.timeout: так её распознает isTimeoutError
	const timer = setTimeout(
		() => controller.abort(new DOMException('Signal timed out', 'TimeoutError')),
		ms,
	);

	try {
		return await request(controller.signal);
	} finally {
		clearTimeout(timer);
		signal.removeEventListener('abort', stop);
	}
}
