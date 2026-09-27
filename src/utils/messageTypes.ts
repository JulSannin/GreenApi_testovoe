// Типы сообщений MAX (поле typeMessage) и что с ними делать в чате.
// Общие для уведомлений и истории переписки.

import { asObject, asText } from './json';

// Типы с текстом. extendedTextMessage — текст со ссылкой, quotedMessage — ответ на сообщение
export const TEXT_TYPES = new Set(['textMessage', 'extendedTextMessage', 'quotedMessage']);

// Служебные «сообщения», которые не показываем вовсе: реакции, правки и удаления.
// Заглушка «не поддерживается» на каждую реакцию только мешала бы
export const IGNORED_TYPES = new Set(['reactionMessage', 'editedMessage', 'deletedMessage']);

// Что написать вместо не-текстового сообщения
const UNSUPPORTED_LABELS: Record<string, string> = {
	imageMessage: 'Фото',
	videoMessage: 'Видео',
	documentMessage: 'Документ',
	audioMessage: 'Аудио',
	stickerMessage: 'Стикер',
	locationMessage: 'Геолокация',
	contactMessage: 'Контакт',
	pollMessage: 'Опрос',
};

export function unsupportedText(typeMessage: string): string {
	const label = UNSUPPORTED_LABELS[typeMessage] ?? 'Сообщение';
	return `${label} — этот тип сообщений пока не поддерживается`;
}

/**
 * Текст сообщения из messageData уведомления. undefined — текста нет (фото и т. п.)
 * или он пришёл не строкой.
 */
export function textFromMessageData(typeMessage: string, messageData: unknown): string | undefined {
	if (!TEXT_TYPES.has(typeMessage)) return undefined;
	const data = asObject(messageData);
	return (
		asText(asObject(data?.textMessageData)?.textMessage) ??
		asText(asObject(data?.extendedTextMessageData)?.text)
	);
}
