// Перехватчик ошибок отрисовки для всего приложения.
// Без него любая ошибка при отрисовке оставляет пустую страницу, где недоступна даже кнопка «Выйти».
// А если причина в сохранённых данных (например, кривое сообщение в localStorage),
// страница остаётся пустой и после перезагрузки. Здесь пользователь видит, что случилось,
// и может перезагрузить страницу или сбросить сохранённые данные.
// Перехватчик в React по-прежнему можно написать только классом.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Button } from '@/ui';
import styles from './ErrorBoundary.module.css';

type Props = {
	children: ReactNode;
};

type State = {
	// Ошибка, из-за которой не удалась отрисовка; null — всё в порядке
	error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
	state: State = { error: null };

	// React вызывает это, когда отрисовка внутри упала: запоминаем ошибку и показываем экран ниже
	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('Ошибка отрисовки', error, info.componentStack);
	}

	render() {
		if (this.state.error) {
			return <CrashScreen error={this.state.error} />;
		}
		return this.props.children;
	}
}

function CrashScreen({ error }: { error: Error }) {
	function reload() {
		window.location.reload();
	}

	function resetData() {
		if (
			window.confirm(
				'Сбросить сохранённые данные? Придётся войти заново, а чаты и переписка на этом устройстве удалятся',
			)
		) {
			// Удаляем сохранённое состояние из localStorage и начинаем с чистого листа
			useChatStore.persist.clearStorage();
			reload();
		}
	}

	return (
		<main className={styles.page}>
			<div className={styles.card} role="alert">
				<h1 className={styles.title}>Что-то пошло не так</h1>
				<p className={styles.text}>
					Приложение не смогло показать экран. Попробуйте перезагрузить страницу. Если ошибка
					повторяется, сбросьте сохранённые данные.
				</p>

				<div className={styles.actions}>
					<Button onClick={reload}>Перезагрузить</Button>
					<Button variant="secondary" onClick={resetData}>
						Сбросить данные
					</Button>
				</div>

				{/* Текст ошибки — для того, кто будет разбираться */}
				<details className={styles.details}>
					<summary>Подробности</summary>
					<pre className={styles.error}>{error.message}</pre>
				</details>
			</div>
		</main>
	);
}
