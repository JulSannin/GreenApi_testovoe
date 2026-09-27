// Разбор ответа getChats: какие чаты из MAX показать в списке.
// Данные с чужого сервера — каждое поле берём, только если оно нужного типа (см. utils/json.ts).

import type { ChatInfo } from '@/store/types';
import { asId, asObject, asPhone, asString } from '@/utils/json';
import { toChatId } from '@/utils/phone';

/**
 * Личные чаты из ответа getChats. Группы, каналы, боты и записи неожиданного вида пропускаются.
 * Ключ чата — номер собеседника (как у чатов, созданных по номеру, и у входящих сообщений);
 * если номер скрыт — id чата в MAX.
 */
export function parseChats(data: unknown): ChatInfo[] {
	if (!Array.isArray(data)) return [];

	const chats: ChatInfo[] = [];
	for (const item of data) {
		const chat = asObject(item);
		const maxChatId = asId(chat?.chatId);
		if (!chat || !maxChatId) continue;

		// Приложение — для личной переписки. Группу узнаём и по отрицательному chatId
		const type = asString(chat.type);
		if ((type && type !== 'user') || maxChatId.startsWith('-')) continue;

		const phone = asPhone(chat.phoneNumber);
		chats.push({
			key: phone ?? maxChatId,
			chatId: phone ? toChatId(phone) : maxChatId,
			maxChatId,
			name: asString(chat.name),
		});
	}
	return chats;
}
