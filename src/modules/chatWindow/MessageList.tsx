// Лента сообщений. При новом сообщении прокручивается вниз — но не выдёргивает пользователя,
// если он читает историю выше.
// Здесь пузыри получают действия: «Повторить» — повторная отправка, «Удалить» — удаление из стора.

import { useEffect, useRef } from 'react';
import { MessageBubble } from '@/components';
import { useChatStore } from '@/store/chatStore';
import type { Chat, Message } from '@/store/types';
import { cx, EmptyState, ErrorText } from '@/ui';
import styles from './MessageList.module.css';
import { retryChatMessage } from './sendChatMessage';
import type { HistoryStatus } from './useChatHistory';

// Насколько близко к низу ленты считаем, что пользователь «внизу»
const BOTTOM_THRESHOLD_PX = 80;

type Props = {
	chat: Chat;
	messages: Message[];
	// Загрузка истории переписки: показываем пометку над сообщениями
	historyStatus: HistoryStatus;
};

export function MessageList({ chat, messages, historyStatus }: Props) {
	const removeMessage = useChatStore((state) => state.removeMessage);
	const listRef = useRef<HTMLDivElement>(null);
	// Был ли пользователь внизу ленты. Сначала да: при открытии чата показываем последние сообщения
	const atBottomRef = useRef(true);

	function handleScroll() {
		const list = listRef.current;
		if (list) {
			atBottomRef.current =
				list.scrollHeight - list.scrollTop - list.clientHeight < BOTTOM_THRESHOLD_PX;
		}
	}

	const lastDirection = messages.at(-1)?.direction;

	// Прокрутка вниз при открытии чата и при новом сообщении.
	// Зависим от количества, а не от массива: смена статуса 'sending' → 'sent'
	// тоже даёт новый массив, но прокручивать из-за неё не нужно
	useEffect(() => {
		const list = listRef.current;
		// Своё сообщение показываем всегда; чужое — только если пользователь и так был внизу
		if (list && (atBottomRef.current || lastDirection === 'out')) {
			list.scrollTop = list.scrollHeight;
		}
	}, [messages.length, lastDirection]);

	return (
		// role="log" — программы экранного доступа зачитывают новые сообщения
		<div ref={listRef} className={styles.list} role="log" onScroll={handleScroll}>
			{/* Пометки про историю — над сообщениями: история старше всего, что уже в ленте */}
			{historyStatus === 'loading' && messages.length > 0 && (
				<p className={cx(styles.note, styles.muted)}>Загружаем историю…</p>
			)}
			{historyStatus === 'error' && (
				<ErrorText className={styles.note}>Не удалось загрузить историю переписки</ErrorText>
			)}

			{messages.length === 0 ? (
				<EmptyState appearance="pill">
					{historyStatus === 'loading' ? 'Загружаем историю…' : 'Напишите первое сообщение'}
				</EmptyState>
			) : (
				messages.map((message) => (
					<MessageBubble
						key={message.id}
						message={message}
						onRetry={() => void retryChatMessage(chat, message)}
						onDelete={() => removeMessage(chat.id, message.id)}
					/>
				))
			)}
		</div>
	);
}
