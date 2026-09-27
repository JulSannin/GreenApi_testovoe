// Лента сообщений. При новом сообщении прокручивается вниз — но не выдёргивает пользователя,
// если он читает историю выше. Перед сообщениями каждого дня — разделитель с датой,
// сообщения одной стороны подряд собраны в группы (раскладку считает groupMessages).
// Здесь пузыри получают действия: «Повторить» — повторная отправка, «Удалить» — удаление из стора.

import { useEffect, useMemo, useRef } from 'react';
import { MessageBubble } from '@/components';
import { useChatStore } from '@/store/chatStore';
import type { Chat, Message } from '@/store/types';
import { cx, EmptyState, ErrorText } from '@/ui';
import { groupMessages } from './groupMessages';
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
	// Пересчитываем раскладку, только когда изменились сами сообщения
	const feed = useMemo(() => groupMessages(messages), [messages]);

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
				feed.map((item) =>
					item.kind === 'day' ? (
						<p key={item.key} className={cx(styles.note, styles.day, styles.muted)}>
							{item.label}
						</p>
					) : (
						<MessageBubble
							key={item.message.id}
							message={item.message}
							isLastInGroup={item.isLastInGroup}
							onRetry={() => void retryChatMessage(chat, item.message)}
							onDelete={() => removeMessage(chat.id, item.message.id)}
						/>
					),
				)
			)}
		</div>
	);
}
