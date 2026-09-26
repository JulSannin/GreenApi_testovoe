// Проверка данных входа перед тем, как пустить пользователя в чат.
// Логика вынесена из компонента, чтобы её можно было протестировать без React.

import { describeServerStatus, isNetworkError, isTimeoutError } from '../../api/errorMessages';
import { ApiError, getStateInstance } from '../../api/greenApi';
import type { Credentials, StateInstance } from '../../api/types';

/**
 * Ошибка входа. Её текст можно показывать пользователю как есть.
 */
export class LoginError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LoginError';
	}
}

// Сколько ждём ответа сервера, прежде чем сдаться
export const CHECK_TIMEOUT_MS = 15_000;

// Пояснения для всех состояний инстанса, кроме 'authorized'.
// Record<Exclude<...>> заставляет TypeScript проверить, что ни одно состояние не забыто
const STATE_MESSAGES: Record<Exclude<StateInstance, 'authorized'>, string> = {
	notAuthorized:
		'Инстанс не авторизован: отсканируйте QR-код в личном кабинете GREEN-API приложением MAX',
	pendingPassword: 'Завершите авторизацию: введите пароль в личном кабинете GREEN-API',
	starting: 'Инстанс запускается, попробуйте через минуту',
	blocked: 'Аккаунт MAX заблокирован',
	suspended: 'На аккаунте MAX временные ограничения на отправку сообщений',
};

/**
 * Проверка полей формы до запроса к серверу.
 * Принимает уже обрезанные от пробелов значения.
 * Возвращает текст ошибки или null, если всё в порядке.
 */
export function validateCredentials({
	apiUrl,
	idInstance,
	apiTokenInstance,
}: Credentials): string | null {
	if (!apiUrl || !idInstance || !apiTokenInstance) {
		return 'Заполните все поля';
	}
	if (!/^\d+$/.test(idInstance)) {
		return 'idInstance должен состоять только из цифр';
	}
	return null;
}

/**
 * Проверяет данные входа запросом getStateInstance.
 * Ничего не возвращает, если инстанс авторизован и готов к работе.
 * Иначе бросает LoginError с понятным пользователю текстом.
 */
export async function checkCredentials(
	credentials: Credentials,
	timeoutMs = CHECK_TIMEOUT_MS,
): Promise<void> {
	let state: StateInstance;
	try {
		// AbortSignal.timeout сам оборвёт запрос, если сервер не ответит за timeoutMs
		state = await getStateInstance(credentials, AbortSignal.timeout(timeoutMs));
	} catch (error) {
		throw new LoginError(describeRequestError(error));
	}

	if (state !== 'authorized') {
		// ?? — на случай, если сервер пришлёт состояние, которого нет в документации
		throw new LoginError(
			STATE_MESSAGES[state] ?? `Инстанс в состоянии «${state}», вход невозможен`,
		);
	}
}

// Превращает ошибку запроса в текст для пользователя
function describeRequestError(error: unknown): string {
	if (error instanceof ApiError) {
		// Неверный токен или несуществующий инстанс
		if ([400, 401, 403, 404].includes(error.status)) {
			return 'Неверные данные: проверьте apiUrl, idInstance и apiTokenInstance';
		}
		// Сервер ответил «успешно», но не JSON — скорее всего, apiUrl указывает на чужой сайт
		if (error.status >= 200 && error.status < 300) {
			return 'Неожиданный ответ сервера: проверьте apiUrl';
		}
		// 429 и 5xx описываются одинаково для всех запросов;
		// остальные коды (405, 466 и т. п.) показываем как есть — по ним легче найти причину
		return describeServerStatus(error.status) ?? `Ошибка сервера GREEN-API (код ${error.status})`;
	}

	if (isTimeoutError(error)) {
		return 'Сервер не отвечает: проверьте apiUrl и подключение к интернету';
	}

	if (isNetworkError(error)) {
		return 'Не удалось связаться с сервером: проверьте apiUrl и подключение к интернету';
	}

	return 'Не удалось проверить данные, попробуйте ещё раз';
}
