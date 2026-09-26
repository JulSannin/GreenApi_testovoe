// Строка списка чатов: аватар, номер, время и начало последнего сообщения.
// Только показ: всё получает через props, о сторе не знает.

import type { Chat, Message } from '@/store/types';
import { Avatar, cx } from '@/ui';
import { chatTitle, formatChatTime } from '@/utils/format';
import styles from './ChatListItem.module.css';

type Props = {
	chat: Chat;
	lastMessage?: Message;
	isActive: boolean;
	onSelect: () => void;
};

export function ChatListItem({ chat, lastMessage, isActive, onSelect }: Props) {
	// Превью: свои сообщения помечаем «Вы:», как в мессенджерах
	let preview = 'Нет сообщений';
	if (lastMessage) {
		preview = lastMessage.direction === 'out' ? `Вы: ${lastMessage.text}` : lastMessage.text;
	}

	return (
		<button
			className={cx(styles.item, isActive && styles.active)}
			type="button"
			onClick={onSelect}
			// Программы экранного доступа сообщат, какой чат сейчас открыт
			aria-current={isActive ? 'true' : undefined}
		>
			<Avatar />
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
