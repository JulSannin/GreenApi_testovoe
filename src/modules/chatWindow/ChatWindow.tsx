// Окно открытого чата: шапка, лента сообщений и поле ввода.

import { ChatHeader } from '@/components';
import { useChatMessages } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import { chatTitle } from '@/utils/format';
import styles from './ChatWindow.module.css';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

type Props = {
	chat: Chat;
	// Кнопка «Назад» в шапке. Нужна ли она, решает страница: на широком экране список виден всегда
	onBack?: () => void;
};

export function ChatWindow({ chat, onBack }: Props) {
	const messages = useChatMessages(chat.id);

	return (
		<section className={styles.window} aria-label={`Чат с ${chatTitle(chat)}`}>
			<ChatHeader chat={chat} onBack={onBack} />
			<MessageList chat={chat} messages={messages} />
			<MessageInput chat={chat} />
		</section>
	);
}
