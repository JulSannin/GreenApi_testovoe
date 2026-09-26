// Одно сообщение: текст, время и статус. Свои — справа, чужие — слева.
// У неотправленного под пузырём текст ошибки и кнопки «Повторить» / «Удалить».
// Только показ: что делают кнопки, решает модуль через onRetry и onDelete.

import type { Message } from '@/store/types';
import { Button, cx, ErrorText } from '@/ui';
import { formatTime } from '@/utils/format';
import styles from './MessageBubble.module.css';

type Props = {
	message: Message;
	onRetry: () => void;
	onDelete: () => void;
};

export function MessageBubble({ message, onRetry, onDelete }: Props) {
	const isOut = message.direction === 'out';
	const isFailed = message.status === 'failed';

	return (
		<div className={cx(styles.row, isOut ? styles.out : styles.in)}>
			<div className={cx(styles.bubble, isFailed && styles.failed)}>
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
					<ErrorText>{message.error ?? 'Не отправлено'}</ErrorText>
					<Button variant="link" onClick={onRetry}>
						Повторить
					</Button>
					<Button variant="link" onClick={onDelete}>
						Удалить
					</Button>
				</div>
			)}
		</div>
	);
}
