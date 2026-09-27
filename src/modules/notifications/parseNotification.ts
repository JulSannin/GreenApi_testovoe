// Разбор уведомления из очереди GREEN-API: что из него попадёт в чат.
// Чистая функция без запросов и стора — поэтому легко проверяется тестами.
//
// Это граница, через которую в приложение попадают чужие данные, поэтому форме уведомления
// не доверяем: каждое поле берём, только если оно нужного типа (см. utils/json.ts). Иначе одна
// кривая запись уронила бы разбор (и навсегда заблокировала очередь) или отрисовку (и всё приложение).
// Ожидаемый формат описан в типе WebhookBody (api/types.ts).

import type { Message, MessageDirection } from '@/store/types';
import { asId, asObject, asPhone, asString, secondsToMs } from '@/utils/json';
import { IGNORED_TYPES, textFromMessageData, unsupportedText } from '@/utils/messageTypes';
import { toChatId } from '@/utils/phone';

/**
 * Сообщение из уведомления, готовое для стора.
 */
export type ParsedMessage = {
	// Ключ чата, если его можно понять по самому уведомлению, — номер собеседника.
	// null — ключ ищется по maxChatId среди известных чатов (resolveChatKey)
	chatKey: string | null;
	// Куда отвечать через sendMessage
	chatId: string;
	// id чата в MAX
	maxChatId: string;
	// Имя собеседника, если оно пришло
	name?: string;
	message: Message;
};

// Какие уведомления показываем в чате и в какую сторону
const DIRECTIONS: Record<string, MessageDirection> = {
	incomingMessageReceived: 'in',
	// Сообщение, которое владелец отправил с телефона или из другого приложения MAX.
	// Отправленные через API (outgoingAPIMessageReceived) не берём: их отправили мы сами,
	// и они уже в чате
	outgoingMessageReceived: 'out',
};

/**
 * Превращает уведомление в сообщение для стора.
 * Возвращает null, если уведомление не нужно показывать: статусы доставки, состояние инстанса,
 * отправленные через API, групповые чаты, реакции — и уведомления неожиданного вида,
 * из которых не понять, какое это сообщение и в каком чате.
 * now передаётся параметром, чтобы тесты не зависели от текущего времени.
 */
export function parseNotification(body: unknown, now = Date.now()): ParsedMessage | null {
	const data = asObject(body);
	const direction = DIRECTIONS[asString(data?.typeWebhook) ?? ''];
	if (!data || !direction) return null;

	const sender = asObject(data.senderData);
	const messageData = asObject(data.messageData);
	const idMessage = asId(data.idMessage);
	const chatId = asId(sender?.chatId);
	const typeMessage = asString(messageData?.typeMessage);
	// Без id сообщения не отсечь дубли, без chatId непонятно, в какой чат класть
	if (!sender || !messageData || !idMessage || !chatId || !typeMessage) return null;

	// Приложение — для личной переписки: группы, каналы и боты не показываем.
	// Группу узнаём и по отрицательному chatId (так в документации: '-69876543210123') —
	// на случай, если chatType не придёт. Если нет ни того ни другого, считаем чат личным
	const chatType = asString(sender.chatType);
	if ((chatType && chatType !== 'user') || chatId.startsWith('-')) {
		return null;
	}

	if (IGNORED_TYPES.has(typeMessage)) return null;

	// В исходящем senderData описывает отправителя — владельца аккаунта, поэтому номер и имя
	// берём только из входящих. Исходящее находит свой чат по chatId
	const isIncoming = direction === 'in';

	// Ключ — номер телефона: по нему ответ находит чат, созданный по номеру.
	// Номера может не быть (скрыт или 0) — тогда чат ищется по id в MAX
	const phone = isIncoming ? asPhone(sender.senderPhoneNumber) : null;

	// Имя из контактов владельца важнее имени из профиля: так его знает пользователь
	const name = isIncoming
		? [sender.senderContactName, sender.senderName, sender.chatName].map(asString).find(Boolean)
		: undefined;

	// Текст — только строкой. Не-строковый текст (объект и т. п.) показываем заглушкой:
	// React не умеет выводить объект, и такое сообщение уронило бы всё приложение
	const text = textFromMessageData(typeMessage, messageData);

	return {
		chatKey: phone,
		chatId: phone ? toChatId(phone) : chatId,
		maxChatId: chatId,
		name,
		message: {
			id: idMessage,
			text: text ?? unsupportedText(typeMessage),
			direction,
			// GREEN-API присылает секунды, в сторе — миллисекунды.
			// Кривое время заменяем текущим: иначе пузырь с датой NaN сломал бы отрисовку
			timestamp: secondsToMs(data.timestamp) ?? now,
			...(direction === 'out' && { status: 'sent' as const }),
			...(text === undefined && { unsupported: true }),
		},
	};
}

/**
 * В какой чат положить сообщение. Главный признак чата — его id в MAX: он не меняется,
 * а номер может быть виден в одном месте и скрыт в другом (например, в списке чатов скрыт,
 * а в уведомлении пришёл) — и тогда по номеру получился бы второй чат с тем же человеком.
 * - Чат с таким id в MAX уже известен (из getChats или прошлых сообщений) — он.
 * - Иначе есть номер собеседника — чат по номеру (в том числе созданный вручную по номеру).
 * - Иначе входящее от незнакомого собеседника — новый чат по id в MAX.
 * - Исходящее в незнакомый чат — null: не понять, чей это чат. Оно появится в истории переписки.
 */
export function resolveChatKey(
	parsed: ParsedMessage,
	findKeyByMaxId: (maxChatId: string) => string | undefined,
): string | null {
	const known = findKeyByMaxId(parsed.maxChatId);
	if (known) return known;

	if (parsed.chatKey) return parsed.chatKey;

	return parsed.message.direction === 'in' ? parsed.maxChatId : null;
}
