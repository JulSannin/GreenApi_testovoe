// Страница входа: форма входа по центру экрана.

import { LoginForm } from '@/modules/auth';
import styles from './LoginPage.module.css';

export function LoginPage() {
	return (
		<main className={styles.page}>
			<LoginForm />
		</main>
	);
}
