// Страница чата: слева список чатов, справа открытая переписка.
// На узком экране (телефон) видна только одна часть: список, а после выбора чата — переписка.
// Страница собирает модули и связывает их между собой: кнопку «Выйти» из auth
// она вставляет в шапку chatList, чтобы модули не импортировали друг друга.

import { LogoutButton } from '@/modules/auth';
import { ChatSidebar } from '@/modules/chatList';
import { ChatWindow } from '@/modules/chatWindow';
import { useActiveChat } from '@/store/chatStore';
import { cx, EmptyState } from '@/ui';
import styles from './ChatPage.module.css';

export function ChatPage() {
	const activeChat = useActiveChat();

	return (
		// Класс chatOpen говорит CSS, что на телефоне нужно показать переписку, а не список
		<div className={cx(styles.screen, activeChat && styles.chatOpen)}>
			<aside className={styles.sidebar}>
				<ChatSidebar headerActions={<LogoutButton />} />
			</aside>

			<main className={styles.main}>
				{activeChat ? (
					// key: при переключении чата окно создаётся заново — сбрасываются поле ввода и прокрутка
					<ChatWindow key={activeChat.id} chat={activeChat} />
				) : (
					<EmptyState>Выберите чат или создайте новый</EmptyState>
				)}
			</main>
		</div>
	);
}
