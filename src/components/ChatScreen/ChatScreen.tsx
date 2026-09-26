// Экран чата. Пока только шапка с кнопкой выхода —
// список чатов и окно переписки появятся на шаге 5.

import { useChatStore } from '../../store/chatStore';
import styles from './ChatScreen.module.css';

export function ChatScreen() {
	const idInstance = useChatStore((state) => state.credentials?.idInstance);
	const logout = useChatStore((state) => state.logout);

	return (
		<div className={styles.screen}>
			<header className={styles.header}>
				<span className={styles.instance}>Инстанс {idInstance}</span>
				{/* logout очищает стор, и App сам вернёт экран входа */}
				<button className={styles.logout} type="button" onClick={logout}>
					Выйти
				</button>
			</header>

			<main className={styles.placeholder}>Здесь будут чаты</main>
		</div>
	);
}
