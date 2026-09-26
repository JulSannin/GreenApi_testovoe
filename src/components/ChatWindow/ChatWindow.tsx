// Окно открытого чата: шапка, лента сообщений и поле ввода.

import { useChatMessages } from '../../store/chatStore';
import type { Chat } from '../../store/types';
import { chatTitle } from '../../utils/format';
import { ChatHeader } from './ChatHeader';
import styles from './ChatWindow.module.css';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

type Props = {
	chat: Chat;
};

export function ChatWindow({ chat }: Props) {
	const messages = useChatMessages(chat.id);

	return (
		<section className={styles.window} aria-label={`Чат с ${chatTitle(chat)}`}>
			<ChatHeader chat={chat} />
			<MessageList chat={chat} messages={messages} />
			<MessageInput chat={chat} />
		</section>
	);
}
