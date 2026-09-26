export type Credentials = {
	apiUrl: string;
	idInstance: string;
	apiTokenInstance: string;
};

export type StateInstance =
	'notAuthorized' | 'authorized' | 'blocked' | 'starting' | 'suspended' | 'pendingPassword';

export type SendMessageResponse = { idMessage: string };
export type DeleteNotificationResponse = { result: boolean; reason: string };

// Описываем только поля, которые нам нужны. Остальные типы уведомлений отбросим при разборе на шаге 6
export type WebhookBody = {
	typeWebhook: string; // нам нужен 'incomingMessageReceived'
	timestamp: number;
	idMessage?: string;
	senderData?: {
		chatId: string;
		sender: string;
		senderPhoneNumber?: number;
	};
	messageData?: {
		typeMessage: string; // нам нужен 'textMessage'
		textMessageData?: { textMessage: string };
	};
};

export type Notification = { receiptId: number; body: WebhookBody };
