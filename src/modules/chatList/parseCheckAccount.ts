// Разбор ответа checkAccount. Данные с чужого сервера — поля берём, только если они нужного типа.

import { asId, asObject } from '@/utils/json';

/**
 * exist — есть ли у номера аккаунт MAX; chatId — id чата с ним (если есть).
 * null — ответ не понять: тогда ничего не решаем и не запоминаем.
 */
export function parseCheckAccount(data: unknown): { exist: boolean; chatId?: string } | null {
	const result = asObject(data);
	if (typeof result?.exist !== 'boolean') return null;
	return { exist: result.exist, chatId: result.exist ? asId(result.chatId) : undefined };
}
