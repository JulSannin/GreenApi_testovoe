// Шапка панели: заголовок с подзаголовком и места для кнопок слева и справа.
// Одинаково выглядит над списком чатов и над перепиской.

import type { ReactNode } from 'react';
import { cx } from '@/ui/cx';
import styles from './PanelHeader.module.css';

type Props = {
	title: ReactNode;
	subtitle?: ReactNode;
	// Уровень заголовка: 1 — главный заголовок экрана, 2 — заголовок части экрана
	level?: 1 | 2;
	// Что поставить слева от заголовка (например, кнопку «Назад») и справа (например, «Выйти»)
	before?: ReactNode;
	after?: ReactNode;
};

export function PanelHeader({ title, subtitle, level = 2, before, after }: Props) {
	const Heading = level === 1 ? 'h1' : 'h2';

	return (
		<header className={styles.header}>
			{before}
			<div className={styles.text}>
				<Heading className={cx(styles.title, level === 1 && styles.large)}>{title}</Heading>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			{after}
		</header>
	);
}
