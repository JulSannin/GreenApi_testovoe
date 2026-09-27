// Строка списка чатов: аватар, имя (или номер), время и начало последнего сообщения.
// Только показ: всё получает через props, о сторе не знает.

import type { Chat, Message } from '@/store/types';
import { Avatar, cx } from '@/ui';
import { chatTitle, formatChatTime, initials } from '@/utils/format';
import styles from './ChatListItem.module.css';

type Props = {
	chat: Chat;
	lastMessage?: Message;
	isActive: boolean;
	onSelect: () => void;
};

export function ChatListItem({ chat, lastMessage, isActive, onSelect }: Props) {
	// Превью: свои сообщения помечаем «Вы:», как в мессенджерах.
	// Чат из MAX без загруженных сообщений — переписка есть, просто ещё не загружена
	let preview = chat.maxChatId ? 'Откройте, чтобы загрузить переписку' : 'Нет сообщений';
	if (lastMessage) {
		preview = lastMessage.direction === 'out' ? `Вы: ${lastMessage.text}` : lastMessage.text;
	}
	// lastMessageAt = 0 — чат пришёл из списка MAX без сообщений, времени показать нечего
	const time = chat.lastMessageAt > 0 ? formatChatTime(chat.lastMessageAt) : '';

	return (
		<button
			className={cx(styles.item, isActive && styles.active)}
			type="button"
			onClick={onSelect}
			// Программы экранного доступа сообщат, какой чат сейчас открыт
			aria-current={isActive ? 'true' : undefined}
		>
			{/* Цвет аватара — по ключу чата: у одного чата он не меняется */}
			<Avatar initials={initials(chat.name)} colorKey={chat.id} size="lg" />
			<span className={styles.body}>
				<span className={styles.top}>
					<span className={styles.title}>{chatTitle(chat)}</span>
					<span className={styles.time}>{time}</span>
				</span>
				<span className={styles.preview}>{preview}</span>
			</span>
		</button>
	);
}
