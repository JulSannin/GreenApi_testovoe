// Разбор ответа getChatHistory: сообщения для ленты.
// Данные с чужого сервера — каждое поле берём, только если оно нужного типа (см. utils/json.ts).

import type { Message } from '@/store/types';
import { asId, asObject, asString, asText, secondsToMs } from '@/utils/json';
import { IGNORED_TYPES, TEXT_TYPES, unsupportedText } from '@/utils/messageTypes';

// type из ответа → направление в ленте
const DIRECTIONS: Record<string, Message['direction']> = { incoming: 'in', outgoing: 'out' };

/**
 * Сообщения из ответа getChatHistory: входящие и исходящие, в том числе отправленные с телефона.
 * Реакции, правки и записи, которые не поставить в ленту (без id, времени или направления),
 * пропускаются. Не-текстовые — заглушкой, как во входящих уведомлениях.
 */
export function parseHistory(data: unknown): Message[] {
	if (!Array.isArray(data)) return [];

	const messages: Message[] = [];
	for (const item of data) {
		const entry = asObject(item);
		const id = asId(entry?.idMessage);
		const timestamp = secondsToMs(entry?.timestamp);
		const typeMessage = asString(entry?.typeMessage);
		const direction = DIRECTIONS[asString(entry?.type) ?? ''];
		if (!entry || !id || !timestamp || !typeMessage || !direction) continue;

		if (IGNORED_TYPES.has(typeMessage)) continue;

		const text = TEXT_TYPES.has(typeMessage) ? asText(entry.textMessage) : undefined;
		messages.push({
			id,
			text: text ?? unsupportedText(typeMessage),
			direction,
			timestamp,
			// Исходящее в истории уже отправлено
			...(direction === 'out' && { status: 'sent' as const }),
			...(text === undefined && { unsupported: true }),
		});
	}
	return messages;
}
