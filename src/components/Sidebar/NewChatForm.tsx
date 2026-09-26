// Форма «новый чат по номеру телефона».

import { useId, useState, type SubmitEvent } from 'react';
import { useChatStore } from '../../store/chatStore';
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
				<input
					className={styles.input}
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
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					autoComplete="off"
				/>
				<button className={styles.button} type="submit" disabled={!phone.trim()}>
					Создать
				</button>
			</div>

			{error && (
				<p id={errorId} className={styles.error} role="alert">
					{error}
				</p>
			)}
		</form>
	);
}
