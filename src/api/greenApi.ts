// Слой работы с GREEN-API. Компоненты вызывают только экспортируемые функции
// (getStateInstance, sendMessage, receiveNotification, deleteNotification)
// и ничего не знают про адреса, заголовки и формат ответов сервера.

import type {
	Credentials,
	DeleteNotificationResponse,
	Notification,
	SendMessageResponse,
	StateInstance,
} from './types';

/**
 * Ошибка ответа сервера. Помимо текста хранит HTTP-статус,
 * чтобы по нему понять причину: 401 — неверный токен, 429 — слишком много запросов и т. д.
 */
export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

// Настройки одного запроса. Все поля необязательные — у каждого есть значение по умолчанию.
type RequestOptions = {
	// HTTP-метод, по умолчанию GET
	httpMethod?: 'GET' | 'POST' | 'DELETE';
	// Сегмент пути после токена, например receiptId у deleteNotification
	pathSuffix?: string;
	// Параметры после «?», например { receiveTimeout: 20 }
	query?: Record<string, string | number>;
	// Тело запроса — объект, который уйдёт на сервер в виде JSON
	body?: unknown;
	// Сигнал AbortController: позволяет оборвать запрос, не дожидаясь ответа
	signal?: AbortSignal;
	// receiveNotification при пустой очереди отдаёт null — для него это не ошибка
	allowEmpty?: boolean;
};

// Собирает адрес запроса. У всех методов GREEN-API он устроен одинаково:
// {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
// Пример: https://3100.api.green-api.com/waInstance3100123456/sendMessage/abc
function buildUrl(
	{ apiUrl, idInstance, apiTokenInstance }: Credentials,
	method: string,
	pathSuffix = '',
	query?: Record<string, string | number>,
): string {
	// Убираем пробелы и «/» в конце apiUrl, иначе в адресе получится «//waInstance...»
	const host = apiUrl.trim().replace(/\/+$/, '');
	// Без протокола fetch посчитает адрес относительным и отправит запрос на наш же сайт
	const base = /^https?:\/\//i.test(host) ? host : `https://${host}`;
	// При копировании из личного кабинета легко захватить пробел или перенос строки
	const id = idInstance.trim();
	const token = apiTokenInstance.trim();

	const url = `${base}/waInstance${id}/${method}/${token}${pathSuffix}`;
	if (!query) return url;

	// { receiveTimeout: 20 } → "receiveTimeout=20"
	const params = new URLSearchParams(
		Object.entries(query).map(([key, value]) => [key, String(value)]),
	);
	return `${url}?${params}`;
}

// Общая функция, через которую идут все запросы.
// T — тип ожидаемого ответа. Это подсказка для TypeScript, а не проверка реальных данных.
async function request<T>(
	credentials: Credentials,
	method: string,
	options: RequestOptions = {},
): Promise<T> {
	const { httpMethod = 'GET', pathSuffix, query, body, signal, allowEmpty = false } = options;
	const hasBody = body !== undefined;

	// Если есть тело — превращаем его в JSON-строку и говорим серверу, что шлём JSON.
	// signal передаём в fetch: после controller.abort() fetch сразу упадёт с AbortError.
	// AbortError здесь не перехватываем — он уходит наверх как есть,
	// чтобы цикл приёма отличал «меня остановили» от «упала сеть».
	const response = await fetch(buildUrl(credentials, method, pathSuffix, query), {
		method: httpMethod,
		headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
		body: hasBody ? JSON.stringify(body) : undefined,
		signal,
	});

	// Читаем ответ как текст, а не через response.json():
	// на пустом ответе response.json() упал бы с ошибкой
	const text = await response.text();

	// Статус не 2xx — ошибка сервера: бросаем ApiError со статусом и текстом ответа
	if (!response.ok) {
		throw new ApiError(response.status, text || response.statusText || `HTTP ${response.status}`);
	}

	// Пустой ответ: для receiveNotification это «очередь пуста», для остальных методов — ошибка
	if (!text || text === 'null') {
		if (allowEmpty) return null as T;
		throw new ApiError(response.status, `Пустой ответ на ${method}`);
	}

	// Вместо JSON может прийти, например, HTML-страница — превращаем SyntaxError в понятную ApiError
	try {
		return JSON.parse(text) as T;
	} catch {
		throw new ApiError(response.status, `Некорректный ответ на ${method}: ожидался JSON`);
	}
}

/**
 * Состояние инстанса: 'authorized', 'notAuthorized', 'blocked' и т. д.
 * Используется на экране входа, чтобы проверить введённые данные.
 */
export async function getStateInstance(
	credentials: Credentials,
	signal?: AbortSignal,
): Promise<StateInstance> {
	const data = await request<{ stateInstance: StateInstance }>(credentials, 'getStateInstance', {
		signal,
	});
	// Сервер отвечает { stateInstance: 'authorized' } — отдаём наружу только строку
	return data.stateInstance;
}

/**
 * Отправляет текстовое сообщение в чат.
 * chatId — номер в формате "79991234567@c.us" или id чата в MAX.
 * Возвращает { idMessage } — id отправленного сообщения.
 */
export function sendMessage(
	credentials: Credentials,
	chatId: string,
	message: string,
	signal?: AbortSignal,
): Promise<SendMessageResponse> {
	return request<SendMessageResponse>(credentials, 'sendMessage', {
		httpMethod: 'POST',
		body: { chatId, message },
		signal,
	});
}

/**
 * Забирает одно уведомление из очереди входящих (не удаляя его).
 * Long polling: если очередь пуста, сервер держит запрос открытым до receiveTimeout секунд (5–60)
 * и ждёт новое уведомление. Если так ничего и не пришло — возвращает null.
 */
export function receiveNotification(
	credentials: Credentials,
	signal?: AbortSignal,
	receiveTimeout = 20,
): Promise<Notification | null> {
	return request<Notification | null>(credentials, 'receiveNotification', {
		query: { receiveTimeout },
		signal,
		allowEmpty: true,
	});
}

/**
 * Удаляет обработанное уведомление из очереди по receiptId, полученному из receiveNotification.
 * Без удаления уведомление останется первым в очереди и будет приходить снова.
 */
export function deleteNotification(
	credentials: Credentials,
	receiptId: number,
	signal?: AbortSignal,
): Promise<DeleteNotificationResponse> {
	return request<DeleteNotificationResponse>(credentials, 'deleteNotification', {
		httpMethod: 'DELETE',
		pathSuffix: `/${receiptId}`,
		signal,
	});
}
