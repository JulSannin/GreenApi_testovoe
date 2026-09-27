export type Credentials = {
	apiUrl: string;
	idInstance: string;
	apiTokenInstance: string;
};

export type StateInstance =
	'notAuthorized' | 'authorized' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';

export type SendMessageResponse = { idMessage: string };
export type DeleteNotificationResponse = { result: boolean; reason: string };

// Тело уведомления из очереди. Описываем только поля, которые нам нужны
// (формат — по документации GREEN-API для MAX v3, раздел «Формат входящих уведомлений»)
export type WebhookBody = {
	typeWebhook: string; // нам нужен 'incomingMessageReceived'
	timestamp: number; // в секундах
	idMessage?: string;
	senderData?: {
		chatId: string;
		chatType?: string; // 'user' — личный чат, 'group' — группа
		chatName?: string;
		sender: string;
		senderName?: string; // имя из профиля MAX
		senderContactName?: string; // имя из контактов владельца инстанса
		senderPhoneNumber?: number; // в группах — 0
	};
	messageData?: {
		typeMessage: string; // 'textMessage', 'extendedTextMessage', 'imageMessage', ...
		textMessageData?: { textMessage: string };
		extendedTextMessageData?: { text: string };
	};
};

export type Notification = { receiptId: number; body: WebhookBody };

// Настройки инстанса (getSettings / setSettings). Значения флагов — строки 'yes' или 'no'.
// По документации после создания инстанса все уведомления выключены
export type InstanceSettings = {
	typeInstance?: string; // 'v3' — MAX
	webhookUrl?: string; // если заполнен, уведомления уходят туда, а не в очередь HTTP API
	incomingWebhook?: string; // уведомления о входящих сообщениях
	outgoingMessageWebhook?: string; // уведомления о сообщениях, отправленных с телефона
};

export type SaveSettingsResponse = { saveSettings: boolean };

// Ответ checkAccount: есть ли у номера аккаунт MAX и какой у чата с ним id
export type CheckAccountResponse = {
	exist: boolean;
	chatId?: string;
};

// Чат из getChats. phoneNumber — 0, если номер скрыт или это группа
export type RemoteChat = {
	chatId: string;
	name: string;
	type: string; // 'user' — личный чат; 'group', 'channel', 'bot'
	phoneNumber: number;
};

// Сообщение из getChatHistory
export type HistoryMessage = {
	type: 'incoming' | 'outgoing';
	idMessage: string;
	timestamp: number; // в секундах
	typeMessage: string;
	chatId: string;
	textMessage?: string;
	senderName?: string;
};
