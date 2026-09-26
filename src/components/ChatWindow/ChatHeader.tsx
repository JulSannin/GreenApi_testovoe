// Шапка чата: номер собеседника. На телефоне ещё кнопка «Назад» к списку чатов.

import { useChatStore } from '../../store/chatStore';
import type { Chat } from '../../store/types';
import { chatTitle } from '../../utils/format';
import styles from './ChatHeader.module.css';

type Props = {
	chat: Chat;
};

export function ChatHeader({ chat }: Props) {
	const setActiveChat = useChatStore((state) => state.setActiveChat);

	return (
		<header className={styles.header}>
			{/* Кнопка видна только на узком экране — см. ChatHeader.module.css */}
			<button
				className={styles.back}
				type="button"
				onClick={() => setActiveChat(null)}
				aria-label="Назад к списку чатов"
			>
				<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
					<path
						d="M15 18l-6-6 6-6"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
			<h2 className={styles.title}>{chatTitle(chat)}</h2>
		</header>
	);
}
