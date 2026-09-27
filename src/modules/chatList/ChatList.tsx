// Список чатов: сначала с перепиской (новые сверху), потом чаты из MAX без загруженных сообщений.

import { ChatListItem } from '@/components';
import { useChatStore, useLastMessage, useSortedChats } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import { EmptyState } from '@/ui';
import styles from './ChatList.module.css';

type Props = {
	// Идёт загрузка чатов из MAX
	isLoading: boolean;
};

export function ChatList({ isLoading }: Props) {
	const chats = useSortedChats();
	const activeChatId = useChatStore((state) => state.activeChatId);
	const setActiveChat = useChatStore((state) => state.setActiveChat);

	if (chats.length === 0) {
		return (
			<EmptyState>
				{isLoading ? 'Загружаем чаты из MAX…' : 'Чатов пока нет. Создайте чат по номеру телефона'}
			</EmptyState>
		);
	}

	return (
		<ul className={styles.list}>
			{chats.map((chat) => (
				<li key={chat.id}>
					<ChatListRow
						chat={chat}
						isActive={chat.id === activeChatId}
						onSelect={() => setActiveChat(chat.id)}
					/>
				</li>
			))}
		</ul>
	);
}

type RowProps = {
	chat: Chat;
	isActive: boolean;
	onSelect: () => void;
};

// Обёртка над ChatListItem: берёт из стора последнее сообщение своего чата.
// Каждая строка подписана только на свой чат, поэтому новое сообщение
// перерисовывает одну строку, а не весь список
function ChatListRow(props: RowProps) {
	const lastMessage = useLastMessage(props.chat.id);
	return <ChatListItem {...props} lastMessage={lastMessage} />;
}
