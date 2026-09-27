// Одно сообщение: текст, время и статус. Свои — справа, чужие — слева.
// Время и статус стоят внутри пузыря, в правом нижнем углу — на последней строке текста,
// если там хватает места, иначе строкой ниже.
// У неотправленного под пузырём текст ошибки и кнопки «Повторить» / «Удалить».
// Только показ: что делают кнопки и где кончается группа сообщений, решает модуль.

import type { Message } from '@/store/types';
import { Button, cx, ErrorText } from '@/ui';
import { formatTime } from '@/utils/format';
import styles from './MessageBubble.module.css';

type Props = {
	message: Message;
	// Последнее сообщение в группе подряд идущих от одной стороны: у него хвостик и отступ снизу
	isLastInGroup: boolean;
	onRetry: () => void;
	onDelete: () => void;
};

export function MessageBubble({ message, isLastInGroup, onRetry, onDelete }: Props) {
	const isOut = message.direction === 'out';
	const isFailed = message.status === 'failed';

	return (
		<div className={cx(styles.row, isOut ? styles.out : styles.in, isLastInGroup && styles.last)}>
			<div className={cx(styles.bubble, isFailed && styles.failed)}>
				<p className={styles.text}>
					{/* Заглушку вместо фото, стикера и т. п. выделяем, чтобы не спутать с текстом собеседника */}
					<span className={cx(message.unsupported && styles.unsupported)}>{message.text}</span>
					<span className={styles.meta}>
						<time dateTime={new Date(message.timestamp).toISOString()}>
							{formatTime(message.timestamp)}
						</time>
						{/* role="img" нужен, чтобы aria-label учитывался: на простом span его игнорируют,
						    и программа экранного доступа не прочитала бы статус */}
						{message.status === 'sending' && (
							<span role="img" aria-label="отправляется">
								<ClockIcon />
							</span>
						)}
						{message.status === 'sent' && (
							<span role="img" aria-label="отправлено">
								<CheckIcon />
							</span>
						)}
					</span>
				</p>
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

// Часы — сообщение ещё отправляется
function ClockIcon() {
	return (
		<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
			<circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
			<path
				d="M8 5v3.25l2 1.25"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// Галочка — сервер принял сообщение
function CheckIcon() {
	return (
		<svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
			<path
				d="M3.5 8.5l3 3 6-7"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
