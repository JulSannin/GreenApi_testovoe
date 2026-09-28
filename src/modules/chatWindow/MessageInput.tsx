// Поле ввода сообщения. Enter — отправить, Shift+Enter — перенос строки.
// Благодаря мгновенному показу поле не блокируется: можно сразу писать следующее сообщение.

import { useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react';
import type { Chat } from '@/store/types';
import { IconButton } from '@/ui';
import styles from './MessageInput.module.css';
import { MAX_MESSAGE_LENGTH, sendChatMessage } from './sendChatMessage';

type Props = {
	chat: Chat;
};

export function MessageInput({ chat }: Props) {
	const [text, setText] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Пробелы и пустые строки по краям не отправляем; сообщение из одних пробелов — не отправляем вовсе
	const trimmed = text.trim();

	function send() {
		if (!trimmed) return;
		setText('');
		// Результат отправки (успех или ошибка) запишется в стор — ждать его здесь не нужно
		void sendChatMessage(chat, trimmed);
		// Возвращаем фокус в поле: после клика по кнопке он уходит на неё
		textareaRef.current?.focus();
	}

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		send();
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// isComposing — идёт набор через IME (например, китайский или японский ввод):
		// там Enter подтверждает выбор символа, и отправлять сообщение нельзя.
		// Safari у этого Enter ставит isComposing = false, но keyCode 229 — проверяем и его
		const isComposing = event.nativeEvent.isComposing || event.keyCode === 229;
		if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
			// Без этого Enter вставит перенос строки
			event.preventDefault();
			send();
		}
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit}>
			<textarea
				ref={textareaRef}
				className={styles.textarea}
				value={text}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Сообщение"
				aria-label="Текст сообщения"
				rows={1}
				maxLength={MAX_MESSAGE_LENGTH}
				// Открыли чат — можно сразу печатать
				autoFocus
			/>
			<IconButton type="submit" variant="primary" label="Отправить" disabled={!trimmed}>
				<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
					<path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />
				</svg>
			</IconButton>
		</form>
	);
}
