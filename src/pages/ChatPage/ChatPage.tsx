// Страница чата: слева список чатов, справа открытая переписка.
// На узком экране (телефон) видна только одна часть: список, а после выбора чата — переписка
// с кнопкой «Назад».
// Страница собирает модули и связывает их между собой: кнопку «Выйти» из auth
// она вставляет в шапку chatList, чтобы модули не импортировали друг друга.

import { LogoutButton } from '@/modules/auth';
import { ChatSidebar } from '@/modules/chatList';
import { ChatWindow } from '@/modules/chatWindow';
import { useActiveChat, useChatStore } from '@/store/chatStore';
import { cx, EmptyState, useMediaQuery } from '@/ui';
import styles from './ChatPage.module.css';

// Граница «узкого экрана» — единственное место, где она задана.
// Раскладка решается здесь, а не в компонентах: они узнают о ней через props
const NARROW_SCREEN = '(max-width: 700px)';

export function ChatPage() {
	const activeChat = useActiveChat();
	const setActiveChat = useChatStore((state) => state.setActiveChat);
	const isNarrow = useMediaQuery(NARROW_SCREEN);

	return (
		// narrow — одна колонка; chatOpen — на узком экране показать переписку, а не список
		<div className={cx(styles.screen, isNarrow && styles.narrow, activeChat && styles.chatOpen)}>
			<aside className={styles.sidebar}>
				<ChatSidebar headerActions={<LogoutButton />} />
			</aside>

			<main className={styles.main}>
				{activeChat ? (
					<ChatWindow
						// key: при переключении чата окно создаётся заново — сбрасываются поле ввода и прокрутка
						key={activeChat.id}
						chat={activeChat}
						// «Назад» нужна только на узком экране: на широком список чатов виден всегда
						onBack={isNarrow ? () => setActiveChat(null) : undefined}
					/>
				) : (
					<EmptyState>Выберите чат или создайте новый</EmptyState>
				)}
			</main>
		</div>
	);
}
