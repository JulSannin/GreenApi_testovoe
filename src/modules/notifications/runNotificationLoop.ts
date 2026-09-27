// Цикл приёма уведомлений (технология HTTP API в GREEN-API):
//   1. receiveNotification — забрать одно уведомление из очереди (сервер ждёт до 20 с, если пусто);
//   2. разобрать его и, если это входящее сообщение, передать в onMessage;
//   3. deleteNotification — удалить уведомление из очереди;
//   4. повторить.
// Цикл крутится, пока не оборван signal (пользователь ушёл с экрана чата или вышел).
// Логика без React — поэтому проверяется тестами с подменённым fetch.

import { describeServerStatus, isNetworkError, isTimeoutError } from '@/api/errorMessages';
import { ApiError, deleteNotification, receiveNotification } from '@/api/greenApi';
import type { Credentials } from '@/api/types';
import { withTimeout } from '@/api/withTimeout';
import { parseNotification, type ParsedMessage } from './parseNotification';

// Сколько секунд сервер держит запрос, если очередь пуста (допустимо 5–60)
export const RECEIVE_TIMEOUT_S = 20;

// Если сервер ответил «очередь пуста» быстрее, чем за секунду (не выдержал долгий опрос),
// ждём хотя бы столько — иначе цикл закидал бы сервер запросами
export const MIN_EMPTY_POLL_MS = 1000;

// Сколько неудач подряд терпим молча: единичный сбой сети — не повод пугать пользователя
const FAILURES_BEFORE_BANNER = 2;

/**
 * Состояние приёма для интерфейса:
 * ok — всё работает; retrying — сервер недоступен, пробуем снова; unauthorized — токен не подходит.
 */
export type LoopStatus =
	{ kind: 'ok' } | { kind: 'retrying'; message: string } | { kind: 'unauthorized' };

type Options = {
	credentials: Credentials;
	signal: AbortSignal;
	onMessage: (parsed: ParsedMessage) => void;
	onStatus: (status: LoopStatus) => void;
	// Пауза перед повтором. Передаётся параметром, чтобы тесты не ждали по-настоящему.
	// По умолчанию — пауза, которую прерывает возвращение на вкладку или появление сети
	wait?: (ms: number) => Promise<void>;
};

/**
 * Пауза после n-й неудачи подряд: 3 с, 6 с, 12 с, 24 с, дальше 30 с.
 * Растёт, чтобы не заваливать запросами сервер, который и так не отвечает.
 */
export function retryDelay(failures: number): number {
	return Math.min(3000 * 2 ** (failures - 1), 30_000);
}

/**
 * Пауза перед повтором, которая заканчивается раньше:
 * - по signal (цикл остановили — выход не должен ждать 30 секунд);
 * - когда вкладка снова видна или появилась сеть (открыли ноутбук, разблокировали телефон).
 * Если вкладку открыли или сеть вернулась ещё во время запроса, следующая пауза пропускается:
 * после сна запрос обычно падает уже после этих событий.
 */
export function createRetryWaiter(signal: AbortSignal) {
	let woken = false;
	let endPause: (() => void) | null = null;

	const wake = () => {
		woken = true;
		endPause?.();
	};
	const onVisibilityChange = () => {
		if (document.visibilityState === 'visible') {
			wake();
		}
	};

	// В тестах (Node) нет window и document — там паузу прерывает только signal
	const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
	if (hasDom) {
		window.addEventListener('online', wake);
		document.addEventListener('visibilitychange', onVisibilityChange);
	}

	return {
		wait(ms: number): Promise<void> {
			if (woken || signal.aborted) {
				woken = false;
				return Promise.resolve();
			}
			return new Promise((resolve) => {
				const finish = () => {
					clearTimeout(timer);
					signal.removeEventListener('abort', finish);
					endPause = null;
					woken = false;
					resolve();
				};
				const timer = setTimeout(finish, ms);
				signal.addEventListener('abort', finish);
				endPause = finish;
			});
		},

		// Снять обработчики, когда цикл закончился
		dispose() {
			endPause?.();
			if (hasDom) {
				window.removeEventListener('online', wake);
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		},
	};
}

/**
 * Разбор с подстраховкой. parseNotification не должен падать ни на каких данных,
 * но если в нём всё же найдётся ошибка, уведомление надо пропустить и удалить:
 * повтор ничего не даст — оно упадёт так же, а заодно навсегда заблокирует очередь
 * для всех следующих сообщений. (Ошибку в onMessage так не глушим: она может быть
 * временной, и тогда повтор поможет.)
 */
function safeParse(body: unknown): ParsedMessage | null {
	try {
		return parseNotification(body);
	} catch (error) {
		console.error('Не удалось разобрать уведомление GREEN-API, оно пропущено', body, error);
		return null;
	}
}

// Текст для плашки, пока приём не работает
export function describeLoopError(error: unknown): string {
	if (error instanceof ApiError) {
		// По документации так бывает, если в настройках инстанса указан webhookUrl:
		// тогда уведомления уходят туда, а не в очередь HTTP API
		if (error.status === 400) {
			return 'Сервер отклонил запрос приёма (код 400). Проверьте настройки инстанса: поле webhookUrl должно быть пустым';
		}
		const text =
			describeServerStatus(error.status) ?? `Ошибка сервера GREEN-API (код ${error.status})`;
		return `${text}. Пробуем снова…`;
	}
	if (isTimeoutError(error) || isNetworkError(error)) {
		return 'Нет связи с сервером, новые сообщения пока не приходят. Пробуем снова…';
	}
	return 'Не удалось получить новые сообщения. Пробуем снова…';
}

export async function runNotificationLoop({
	credentials,
	signal,
	onMessage,
	onStatus,
	wait,
}: Options): Promise<void> {
	const waiter = wait ? null : createRetryWaiter(signal);
	const pause = wait ?? ((ms: number) => waiter!.wait(ms));
	let failures = 0;

	try {
		while (!signal.aborted) {
			try {
				const startedAt = Date.now();
				// Свой таймаут чуть больше серверного: сервер отвечает не позже чем через 20 с
				const notification = await withTimeout(signal, (RECEIVE_TIMEOUT_S + 10) * 1000, (s) =>
					receiveNotification(credentials, s, RECEIVE_TIMEOUT_S),
				);

				// Ответ мог прийти в тот же миг, когда цикл остановили (например, пользователь вышел):
				// такое уведомление не обрабатываем — иначе сообщение попало бы в уже очищенный стор
				// и после выхода появился бы чат из прошлой сессии. Уведомление останется в очереди
				if (signal.aborted) return;

				if (notification) {
					const parsed = safeParse(notification.body);
					if (parsed) {
						onMessage(parsed);
					} else if (import.meta.env.DEV) {
						// Только при разработке: видно, какие уведомления приходят и не показываются.
						// Если формат MAX разойдётся с документацией, это сразу станет заметно в консоли
						console.debug('[GREEN-API] уведомление не показано в чате:', notification.body);
					}
					// Удаляем любое уведомление, даже ненужное (статус, наше же исходящее):
					// иначе оно навсегда останется первым в очереди.
					// Если удаление не удастся, уведомление придёт снова — дубль отсечёт стор по id
					await withTimeout(signal, 15_000, (s) =>
						deleteNotification(credentials, notification.receiptId, s),
					);
				}

				// Связь восстановилась — убираем плашку, если она была
				if (failures >= FAILURES_BEFORE_BANNER) {
					onStatus({ kind: 'ok' });
				}
				failures = 0;

				// Очередь пуста и сервер ответил мгновенно — не спрашиваем снова в ту же секунду
				if (!notification && Date.now() - startedAt < MIN_EMPTY_POLL_MS) {
					await pause(MIN_EMPTY_POLL_MS);
				}
			} catch (error) {
				// Цикл остановили (выход, уход с экрана) — это не ошибка
				if (signal.aborted) return;

				// Токен больше не подходит (например, его перевыпустили в личном кабинете):
				// повторять бессмысленно — нужен новый вход
				if (error instanceof ApiError && error.status === 401) {
					onStatus({ kind: 'unauthorized' });
					return;
				}

				failures += 1;
				if (failures >= FAILURES_BEFORE_BANNER) {
					onStatus({ kind: 'retrying', message: describeLoopError(error) });
				}
				await pause(retryDelay(failures));
			}
		}
	} finally {
		waiter?.dispose();
	}
}
