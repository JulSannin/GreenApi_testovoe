// Типы данных, которые хранятся в сторе.

/**
 * Чат с одним собеседником.
 * Ключ чата (id) — номер телефона из цифр: по нему входящие ответы находят свой чат
 * (GREEN-API присылает номер отправителя в senderData.senderPhoneNumber).
 * Если номер во входящем не пришёл, ключом становится id чата в MAX из senderData.chatId.
 */
export type Chat = {
	// Ключ чата: '79991234567' или id чата в MAX
	id: string;
	// Куда отправлять сообщения через sendMessage: '79991234567@c.us' или id чата в MAX
	chatId: string;
	// Время последнего сообщения (или создания чата) в миллисекундах — для сортировки списка
	lastMessageAt: number;
};

// 'in' — входящее от собеседника, 'out' — отправленное нами
export type MessageDirection = 'in' | 'out';

// Статус исходящего сообщения:
// 'sending' — показано сразу, ждём ответа сервера; 'sent' — сервер принял; 'failed' — не отправлено
export type MessageStatus = 'sending' | 'sent' | 'failed';

export type Message = {
	// idMessage от GREEN-API — по нему отсекаются дубли.
	// Пока исходящее отправляется, здесь временный id вида 'local-...'
	id: string;
	text: string;
	direction: MessageDirection;
	// В миллисекундах. GREEN-API присылает timestamp в секундах — при разборе умножаем на 1000
	timestamp: number;
	// Только у исходящих; у входящих поля нет
	status?: MessageStatus;
	// Текст ошибки для status: 'failed'
	error?: string;
};
