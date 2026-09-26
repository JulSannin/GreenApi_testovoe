// Экран чата: слева список чатов, справа открытая переписка.
// На узком экране (телефон) видна только одна часть: список, а после выбора чата — переписка.

import { useActiveChat } from '../../store/chatStore';
import { ChatWindow } from '../ChatWindow/ChatWindow';
import { Sidebar } from '../Sidebar/Sidebar';
import styles from './ChatScreen.module.css';

export function ChatScreen() {
	const activeChat = useActiveChat();

	return (
		// Класс chatOpen говорит CSS, что на телефоне нужно показать переписку, а не список
		<div className={`${styles.screen} ${activeChat ? styles.chatOpen : ''}`}>
			<aside className={styles.sidebar}>
				<Sidebar />
			</aside>

			<main className={styles.main}>
				{activeChat ? (
					// key: при переключении чата окно создаётся заново — сбрасываются поле ввода и прокрутка
					<ChatWindow key={activeChat.id} chat={activeChat} />
				) : (
					<p className={styles.placeholder}>Выберите чат или создайте новый</p>
				)}
			</main>
		</div>
	);
}
