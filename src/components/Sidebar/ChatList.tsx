// Список чатов, новые сверху.

import { useChatStore, useSortedChats } from '../../store/chatStore';
import { ChatListItem } from './ChatListItem';
import styles from './ChatList.module.css';

export function ChatList() {
	const chats = useSortedChats();
	const activeChatId = useChatStore((state) => state.activeChatId);
	const setActiveChat = useChatStore((state) => state.setActiveChat);

	if (chats.length === 0) {
		return <p className={styles.empty}>Создайте чат по номеру телефона</p>;
	}

	return (
		<ul className={styles.list}>
			{chats.map((chat) => (
				<li key={chat.id}>
					<ChatListItem
						chat={chat}
						isActive={chat.id === activeChatId}
						onSelect={() => setActiveChat(chat.id)}
					/>
				</li>
			))}
		</ul>
	);
}
