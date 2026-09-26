// Лента сообщений. При появлении нового сообщения прокручивается вниз.
// Здесь пузыри получают действия: «Повторить» — повторная отправка, «Удалить» — удаление из стора.

import { useEffect, useRef } from 'react';
import { MessageBubble } from '@/components';
import { useChatStore } from '@/store/chatStore';
import type { Chat, Message } from '@/store/types';
import { EmptyState } from '@/ui';
import styles from './MessageList.module.css';
import { retryChatMessage } from './sendChatMessage';

type Props = {
	chat: Chat;
	messages: Message[];
};

export function MessageList({ chat, messages }: Props) {
	const removeMessage = useChatStore((state) => state.removeMessage);
	const listRef = useRef<HTMLDivElement>(null);

	// Прокрутка вниз при открытии чата и при каждом новом сообщении.
	// Зависим от количества, а не от массива: смена статуса 'sending' → 'sent'
	// тоже даёт новый массив, но прокручивать из-за неё не нужно
	useEffect(() => {
		const list = listRef.current;
		if (list) {
			list.scrollTop = list.scrollHeight;
		}
	}, [messages.length]);

	return (
		// role="log" — программы экранного доступа будут зачитывать новые сообщения
		<div ref={listRef} className={styles.list} role="log">
			{messages.length === 0 ? (
				<EmptyState appearance="pill">Напишите первое сообщение</EmptyState>
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
