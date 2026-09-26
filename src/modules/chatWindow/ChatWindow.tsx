// Окно открытого чата: шапка, лента сообщений и поле ввода.

import { ChatHeader } from '@/components';
import { useChatMessages, useChatStore } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import { chatTitle } from '@/utils/format';
import styles from './ChatWindow.module.css';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

type Props = {
	chat: Chat;
};

export function ChatWindow({ chat }: Props) {
	const messages = useChatMessages(chat.id);
	const setActiveChat = useChatStore((state) => state.setActiveChat);

	return (
		<section className={styles.window} aria-label={`Чат с ${chatTitle(chat)}`}>
			{/* «Назад» (на телефоне) закрывает чат — страница снова покажет список */}
			<ChatHeader chat={chat} onBack={() => setActiveChat(null)} />
			<MessageList chat={chat} messages={messages} />
			<MessageInput chat={chat} />
		</section>
	);
}
