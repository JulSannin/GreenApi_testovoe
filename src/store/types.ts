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

export type Message = {
	// idMessage от GREEN-API — по нему отсекаются дубли
	id: string;
	text: string;
	direction: MessageDirection;
	// В миллисекундах. GREEN-API присылает timestamp в секундах — при разборе умножаем на 1000
	timestamp: number;
};
