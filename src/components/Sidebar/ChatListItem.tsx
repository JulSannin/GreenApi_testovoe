// Строка списка чатов: аватар, номер, время и начало последнего сообщения.

import { useLastMessage } from '../../store/chatStore';
import type { Chat } from '../../store/types';
import { chatTitle, formatChatTime } from '../../utils/format';
import styles from './ChatListItem.module.css';

type Props = {
	chat: Chat;
	isActive: boolean;
	onSelect: () => void;
};

export function ChatListItem({ chat, isActive, onSelect }: Props) {
	const lastMessage = useLastMessage(chat.id);

	// Превью: свои сообщения помечаем «Вы:», как в мессенджерах
	let preview = 'Нет сообщений';
	if (lastMessage) {
		preview = lastMessage.direction === 'out' ? `Вы: ${lastMessage.text}` : lastMessage.text;
	}

	return (
		<button
			className={`${styles.item} ${isActive ? styles.active : ''}`}
			type="button"
			onClick={onSelect}
			// Программы экранного доступа сообщат, какой чат сейчас открыт
			aria-current={isActive ? 'true' : undefined}
		>
			{/* Аватар — просто круг с иконкой: имён у собеседников нет */}
			<span className={styles.avatar} aria-hidden="true">
				<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
					<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
				</svg>
			</span>

			<span className={styles.body}>
				<span className={styles.top}>
					<span className={styles.title}>{chatTitle(chat)}</span>
					<span className={styles.time}>{formatChatTime(chat.lastMessageAt)}</span>
				</span>
				<span className={styles.preview}>{preview}</span>
			</span>
		</button>
	);
}
