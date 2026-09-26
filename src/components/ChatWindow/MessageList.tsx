// Лента сообщений. При появлении нового сообщения прокручивается вниз.

import { useEffect, useRef } from 'react';
import type { Chat, Message } from '../../store/types';
import { MessageBubble } from './MessageBubble';
import styles from './MessageList.module.css';

type Props = {
	chat: Chat;
	messages: Message[];
};

export function MessageList({ chat, messages }: Props) {
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
				<p className={styles.empty}>Напишите первое сообщение</p>
			) : (
				messages.map((message) => <MessageBubble key={message.id} chat={chat} message={message} />)
			)}
		</div>
	);
}
