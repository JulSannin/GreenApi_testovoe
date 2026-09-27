// Слой работы с GREEN-API. Компоненты вызывают только экспортируемые функции
// (getStateInstance, sendMessage, receiveNotification, deleteNotification, getSettings,
// setSettings, getChats, getChatHistory) и ничего не знают про адреса, заголовки и формат ответов.

import type {
	CheckAccountResponse,
	Credentials,
	DeleteNotificationResponse,
	HistoryMessage,
	InstanceSettings,
	Notification,
	RemoteChat,
	SaveSettingsResponse,
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

// ---------- Повтор при 429 (слишком много запросов) ----------
// У GREEN-API у каждого метода свой лимит частоты: у служебных (getSettings, getChats и т. п.)
// около одного запроса в секунду. Если его превысить, сервер отвечает 429 и запрос не выполняет —
// поэтому его безопасно повторить чуть позже, даже отправку сообщения.
// Так бывает, например, в режиме разработки: React (StrictMode) запускает эффект дважды,
// первый запрос отменяется уже после отправки, и второй упирается в лимит.

// Сколько раз повторяем запрос после ответа 429, прежде чем сдаться
export const RATE_LIMIT_RETRIES = 3;

// Сколько ждать перед повтором: сколько попросил сервер (заголовок Retry-After, в секундах),
// а если не попросил — 1, 2, 3 секунды
function rateLimitDelayMs(response: Response, attempt: number): number {
	const retryAfter = Number(response.headers.get('Retry-After'));
	return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1);
}

// Пауза, которая обрывается вместе с запросом: пользователь ушёл с экрана — ждать незачем
function pause(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason);
			return;
		}
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal?.reason);
		};
		const timer = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});
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
	const send = () =>
		fetch(buildUrl(credentials, method, pathSuffix, query), {
			method: httpMethod,
			headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
			body: hasBody ? JSON.stringify(body) : undefined,
			signal,
		});

	let response = await send();
	for (let attempt = 0; response.status === 429 && attempt < RATE_LIMIT_RETRIES; attempt++) {
		await pause(rateLimitDelayMs(response, attempt), signal);
		response = await send();
	}

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

/**
 * Настройки инстанса: куда и какие уведомления он отправляет.
 */
export function getSettings(
	credentials: Credentials,
	signal?: AbortSignal,
): Promise<InstanceSettings> {
	return request<InstanceSettings>(credentials, 'getSettings', { signal });
}

/**
 * Меняет настройки инстанса. Передаются только те поля, которые нужно изменить.
 * По документации инстанс при этом перезапускается, а настройки вступают в силу в течение 5 минут.
 */
export function setSettings(
	credentials: Credentials,
	settings: InstanceSettings,
	signal?: AbortSignal,
): Promise<SaveSettingsResponse> {
	return request<SaveSettingsResponse>(credentials, 'setSettings', {
		httpMethod: 'POST',
		body: settings,
		signal,
	});
}

/**
 * Есть ли у номера аккаунт MAX и какой id у чата с ним.
 * Нужен, потому что MAX скрывает номера: без этого чат, созданный по номеру, и тот же чат
 * из списка MAX (или входящие от собеседника) выглядели бы как два разных чата.
 * По документации частые проверки, особенно несуществующих номеров, выглядят подозрительно
 * (ошибка 469 — пауза на 2 часа), поэтому каждый номер проверяем один раз.
 */
export function checkAccount(
	credentials: Credentials,
	phone: string,
	signal?: AbortSignal,
): Promise<CheckAccountResponse> {
	return request<CheckAccountResponse>(credentials, 'checkAccount', {
		httpMethod: 'POST',
		// По документации номер передаётся числом
		body: { phoneNumber: Number(phone) },
		signal,
	});
}

/**
 * Список чатов аккаунта MAX: личные, группы, каналы, боты.
 */
export function getChats(credentials: Credentials, signal?: AbortSignal): Promise<RemoteChat[]> {
	return request<RemoteChat[]>(credentials, 'getChats', { signal });
}

/**
 * История сообщений чата — входящие и исходящие (в том числе отправленные с телефона).
 * chatId — id чата в MAX. По документации — не глубже 3 месяцев и 5000 сообщений.
 */
export function getChatHistory(
	credentials: Credentials,
	chatId: string,
	count: number,
	signal?: AbortSignal,
): Promise<HistoryMessage[]> {
	return request<HistoryMessage[]>(credentials, 'getChatHistory', {
		httpMethod: 'POST',
		body: { chatId, count },
		signal,
	});
}
