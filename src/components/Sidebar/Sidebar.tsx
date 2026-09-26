// Левая панель: шапка с инстансом и кнопкой выхода, форма нового чата и список чатов.

import { useChatStore } from '../../store/chatStore';
import { ChatList } from './ChatList';
import { NewChatForm } from './NewChatForm';
import styles from './Sidebar.module.css';

export function Sidebar() {
	const idInstance = useChatStore((state) => state.credentials?.idInstance);
	const logout = useChatStore((state) => state.logout);

	function handleLogout() {
		// Переписка хранится только в этом браузере, и выход стирает её безвозвратно —
		// поэтому спрашиваем подтверждение, чтобы случайный клик ничего не удалил
		if (window.confirm('Выйти? Чаты и переписка на этом устройстве будут удалены')) {
			// logout очищает стор, и App сам вернёт экран входа
			logout();
		}
	}

	return (
		<div className={styles.sidebar}>
			<header className={styles.header}>
				<div>
					<h1 className={styles.title}>Чаты</h1>
					<p className={styles.instance}>Инстанс {idInstance}</p>
				</div>
				<button className={styles.logout} type="button" onClick={handleLogout}>
					Выйти
				</button>
			</header>

			<NewChatForm />

			{/* Прокручивается только список, шапка и форма остаются на месте */}
			<div className={styles.chats}>
				<ChatList />
			</div>
		</div>
	);
}
