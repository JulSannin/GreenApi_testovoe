// Форма «новый чат по номеру телефона».

import { useId, useState, type SubmitEvent } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Button, ErrorText, Input } from '@/ui';
import styles from './NewChatForm.module.css';

export function NewChatForm() {
	const createChat = useChatStore((state) => state.createChat);
	const [phone, setPhone] = useState('');
	const [error, setError] = useState<string | null>(null);
	// Уникальный id, чтобы связать поле с текстом ошибки через aria-describedby
	const errorId = useId();

	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();

		// createChat сам нормализует и проверяет номер; null — номер некорректный
		const chatKey = createChat(phone);
		if (!chatKey) {
			setError('Введите номер с кодом страны, например +7 999 123-45-67');
			return;
		}

		// Чат создан (или уже был) и открыт — очищаем форму
		setPhone('');
		setError(null);
	}

	return (
		<form className={styles.form} onSubmit={handleSubmit} noValidate>
			<div className={styles.row}>
				<Input
					// type="tel" — на телефоне откроется клавиатура для номера
					type="tel"
					value={phone}
					onChange={(e) => {
						setPhone(e.target.value);
						// Ошибка относится к прошлому вводу — убираем, как только номер меняется
						setError(null);
					}}
					placeholder="Номер телефона"
					aria-label="Номер телефона для нового чата"
					invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
					autoComplete="off"
				/>
				<Button type="submit" size="sm" disabled={!phone.trim()}>
					Создать
				</Button>
			</div>

			{error && <ErrorText id={errorId}>{error}</ErrorText>}
		</form>
	);
}
