// Экран входа: пользователь вводит данные инстанса из личного кабинета GREEN-API.
// Данные проверяются запросом к серверу, и только рабочие сохраняются в стор.

import { useState, type SubmitEvent } from 'react';
import type { Credentials } from '../../api/types';
import { useChatStore } from '../../store/chatStore';
import { checkCredentials, LoginError, validateCredentials } from './checkCredentials';
import styles from './LoginForm.module.css';

export function LoginForm() {
	const login = useChatStore((state) => state.login);

	// Значения полей формы
	const [apiUrl, setApiUrl] = useState('');
	const [idInstance, setIdInstance] = useState('');
	const [apiTokenInstance, setApiTokenInstance] = useState('');
	// Текст ошибки под формой; null — ошибки нет
	const [error, setError] = useState<string | null>(null);
	// Идёт проверка на сервере — блокируем поля и кнопку
	const [isChecking, setIsChecking] = useState(false);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		// Без этого браузер перезагрузит страницу при отправке формы
		event.preventDefault();

		// Убираем случайные пробелы, которые легко захватить при копировании
		const credentials: Credentials = {
			apiUrl: apiUrl.trim(),
			idInstance: idInstance.trim(),
			apiTokenInstance: apiTokenInstance.trim(),
		};

		// Сначала проверяем поля без запроса к серверу
		const validationError = validateCredentials(credentials);
		if (validationError) {
			setError(validationError);
			return;
		}

		setError(null);
		setIsChecking(true);
		try {
			await checkCredentials(credentials);
			// Данные рабочие: сохраняем их, и App сам переключится на экран чата.
			// Форма при этом исчезнет, поэтому сбрасывать isChecking не нужно
			login(credentials);
		} catch (e) {
			setError(
				e instanceof LoginError ? e.message : 'Не удалось проверить данные, попробуйте ещё раз',
			);
			setIsChecking(false);
		}
	}

	return (
		<main className={styles.page}>
			{/* noValidate — отключаем встроенные подсказки браузера, проверяем поля сами */}
			<form className={styles.card} onSubmit={handleSubmit} noValidate>
				<div>
					<h1 className={styles.title}>Вход</h1>
					<p className={styles.subtitle}>Чат MAX через GREEN-API</p>
				</div>

				<label className={styles.field}>
					<span className={styles.label}>apiUrl</span>
					<input
						className={styles.input}
						value={apiUrl}
						onChange={(e) => setApiUrl(e.target.value)}
						placeholder="https://..."
						autoComplete="off"
						spellCheck={false}
						disabled={isChecking}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>idInstance</span>
					<input
						className={styles.input}
						value={idInstance}
						onChange={(e) => setIdInstance(e.target.value)}
						// Цифровая клавиатура на телефоне
						inputMode="numeric"
						autoComplete="off"
						disabled={isChecking}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>apiTokenInstance</span>
					<input
						className={styles.input}
						// Токен — секрет, поэтому скрываем его как пароль
						type="password"
						value={apiTokenInstance}
						onChange={(e) => setApiTokenInstance(e.target.value)}
						autoComplete="off"
						disabled={isChecking}
					/>
				</label>

				{/* role="alert" — программы экранного доступа зачитают ошибку сразу, как она появится */}
				{error && (
					<p className={styles.error} role="alert">
						{error}
					</p>
				)}

				<button className={styles.button} type="submit" disabled={isChecking}>
					{isChecking ? 'Проверяем…' : 'Войти'}
				</button>

				<p className={styles.hint}>
					Все три значения есть в личном кабинете{' '}
					<a href="https://console.green-api.com" target="_blank" rel="noreferrer">
						console.green-api.com
					</a>
				</p>
			</form>
		</main>
	);
}
