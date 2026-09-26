import type {
	Credentials,
	DeleteNotificationResponse,
	Notification,
	SendMessageResponse,
	StateInstance,
} from './types';

export class ApiError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

type RequestOptions = {
	httpMethod?: 'GET' | 'POST' | 'DELETE';
	// Сегмент пути после токена, например receiptId у deleteNotification
	pathSuffix?: string;
	query?: Record<string, string | number>;
	body?: unknown;
	signal?: AbortSignal;
	// receiveNotification при пустой очереди отдаёт null — для него это не ошибка
	allowEmpty?: boolean;
};

// Все методы GREEN-API: {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}
function buildUrl(
	{ apiUrl, idInstance, apiTokenInstance }: Credentials,
	method: string,
	pathSuffix = '',
	query?: Record<string, string | number>,
): string {
	const base = apiUrl.trim().replace(/\/+$/, '');
	const url = `${base}/waInstance${idInstance}/${method}/${apiTokenInstance}${pathSuffix}`;
	if (!query) return url;

	const params = new URLSearchParams(
		Object.entries(query).map(([key, value]) => [key, String(value)]),
	);
	return `${url}?${params}`;
}

async function request<T>(
	credentials: Credentials,
	method: string,
	options: RequestOptions = {},
): Promise<T> {
	const { httpMethod = 'GET', pathSuffix, query, body, signal, allowEmpty = false } = options;
	const hasBody = body !== undefined;

	const response = await fetch(buildUrl(credentials, method, pathSuffix, query), {
		method: httpMethod,
		headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
		body: hasBody ? JSON.stringify(body) : undefined,
		signal,
	});

	const text = await response.text();
	if (!response.ok) {
		throw new ApiError(response.status, text || response.statusText || `HTTP ${response.status}`);
	}

	if (!text || text === 'null') {
		if (allowEmpty) return null as T;
		throw new ApiError(response.status, `Пустой ответ на ${method}`);
	}

	return JSON.parse(text) as T;
}

export async function getStateInstance(
	credentials: Credentials,
	signal?: AbortSignal,
): Promise<StateInstance> {
	const data = await request<{ stateInstance: StateInstance }>(credentials, 'getStateInstance', {
		signal,
	});
	return data.stateInstance;
}

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

// Long polling: при пустой очереди сервер держит запрос до receiveTimeout секунд (5–60) и отдаёт null
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
