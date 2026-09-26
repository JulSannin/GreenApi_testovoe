// Одно сообщение: текст, время и статус. Свои — справа, чужие — слева.
// У неотправленного под пузырём текст ошибки и кнопки «Повторить» / «Удалить».

import { useChatStore } from '../../store/chatStore';
import type { Chat, Message } from '../../store/types';
import { formatTime } from '../../utils/format';
import styles from './MessageBubble.module.css';
import { retryChatMessage } from './sendChatMessage';

type Props = {
	chat: Chat;
	message: Message;
};

export function MessageBubble({ chat, message }: Props) {
	const removeMessage = useChatStore((state) => state.removeMessage);
	const isOut = message.direction === 'out';
	const isFailed = message.status === 'failed';

	return (
		<div className={`${styles.row} ${isOut ? styles.out : styles.in}`}>
			<div className={`${styles.bubble} ${isFailed ? styles.failed : ''}`}>
				<p className={styles.text}>{message.text}</p>
				<span className={styles.meta}>
					<time dateTime={new Date(message.timestamp).toISOString()}>
						{formatTime(message.timestamp)}
					</time>
					{message.status === 'sending' && <span>· отправляется</span>}
					{/* role="img" нужен, чтобы aria-label учитывался: на простом span его игнорируют,
					    и программа экранного доступа прочитала бы «галочка» или ничего */}
					{message.status === 'sent' && (
						<span role="img" aria-label="отправлено">
							✓
						</span>
					)}
				</span>
			</div>

			{isFailed && (
				<div className={styles.failure}>
					{/* role="alert" — ошибка будет зачитана сразу, как появится */}
					<span role="alert">{message.error ?? 'Не отправлено'}</span>
					<button
						className={styles.action}
						type="button"
						onClick={() => void retryChatMessage(chat, message)}
					>
						Повторить
					</button>
					<button
						className={styles.action}
						type="button"
						onClick={() => removeMessage(chat.id, message.id)}
					>
						Удалить
					</button>
				</div>
			)}
		</div>
	);
}
