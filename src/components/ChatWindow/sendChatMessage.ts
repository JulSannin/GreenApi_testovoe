// Отправка сообщения с мгновенным показом («оптимистичный» интерфейс):
// сообщение сразу появляется в переписке со статусом «отправляется», а потом
// либо получает настоящий idMessage и статус 'sent', либо помечается 'failed'
// с текстом ошибки и кнопками «Повторить» / «Удалить».
// Логика вынесена из компонентов, чтобы её можно было протестировать без React.

import { describeServerStatus, isNetworkError, isTimeoutError } from '../../api/errorMessages';
import { ApiError, sendMessage } from '../../api/greenApi';
import type { Credentials } from '../../api/types';
import { useChatStore } from '../../store/chatStore';
import type { Chat, Message } from '../../store/types';

// Сколько ждём ответа сервера на отправку
export const SEND_TIMEOUT_MS = 15_000;

// Максимальная длина сообщения по документации SendMessage
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Временный id для сообщения, пока сервер не вернул настоящий idMessage.
 * crypto.randomUUID браузер даёт только на https:// и localhost. Если открыть приложение
 * по http с другого устройства (например, http://192.168.1.8:5173 с телефона), функции нет —
 * тогда собираем id из времени и случайного числа. Для временного id этого достаточно.
 */
export function createLocalId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `local-${crypto.randomUUID()}`;
	}
	return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Показывает сообщение в чате сразу и отправляет его.
 * Промис никогда не отклоняется: результат отправки записывается в стор.
 */
export async function sendChatMessage(chat: Chat, text: string): Promise<void> {
	const { credentials, addMessage } = useChatStore.getState();
	if (!credentials) return;

	const localId = createLocalId();
	addMessage(chat.id, chat.chatId, {
		id: localId,
		text,
		direction: 'out',
		timestamp: Date.now(),
		status: 'sending',
	});

	await deliver(credentials, chat, localId, text);
}

/**
 * Повторная отправка неотправленного сообщения. Пузырь остаётся тем же,
 * меняется только статус: 'failed' → 'sending' → 'sent' или снова 'failed'.
 */
export async function retryChatMessage(chat: Chat, message: Message): Promise<void> {
	const { credentials, updateMessage } = useChatStore.getState();
	if (!credentials) return;

	updateMessage(chat.id, message.id, { status: 'sending', error: undefined });
	await deliver(credentials, chat, message.id, message.text);
}

// Сам запрос и запись результата в стор
async function deliver(
	credentials: Credentials,
	chat: Chat,
	localId: string,
	text: string,
): Promise<void> {
	try {
		const { idMessage } = await sendMessage(
			credentials,
			chat.chatId,
			text,
			AbortSignal.timeout(SEND_TIMEOUT_MS),
		);
		// getState() — заново: за время запроса состояние могло измениться
		useChatStore.getState().confirmMessage(chat.id, localId, idMessage);
	} catch (error) {
		useChatStore.getState().updateMessage(chat.id, localId, {
			status: 'failed',
			error: describeSendError(error),
		});
	}
}

/**
 * Текст ошибки отправки для пользователя.
 */
export function describeSendError(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.status === 400) {
			return 'Не отправлено: проверьте номер и длину текста';
		}
		if (error.status === 401) {
			return 'Сессия недействительна, войдите заново';
		}
		// По документации SendMessage: на аккаунте временные ограничения
		if (error.status === 403) {
			return 'На аккаунте ограничения: писать можно только сохранённым контактам';
		}
		if (error.status >= 200 && error.status < 300) {
			return 'Неожиданный ответ сервера, попробуйте ещё раз';
		}
		return describeServerStatus(error.status) ?? `Ошибка сервера GREEN-API (код ${error.status})`;
	}

	// На таймауте сервер мог успеть отправить сообщение — ответ просто не дошёл до нас.
	// Если написать «не отправлено», пользователь отправит повторно, и получатель получит дубль
	if (isTimeoutError(error)) {
		return 'Сервер не ответил. Сообщение могло уйти — проверьте переписку в MAX перед повторной отправкой';
	}

	if (isNetworkError(error)) {
		return 'Нет связи с сервером, проверьте подключение к интернету';
	}

	return 'Не удалось отправить сообщение';
}
