// Заглушка на месте пустого содержимого: «Выберите чат», «Нет чатов» и т. п.
// plain — серый текст по центру, pill — текст на белой плашке (поверх фона переписки).

import type { ReactNode } from 'react';
import { cx } from '@/ui/cx';
import styles from './EmptyState.module.css';

type Props = {
	children: ReactNode;
	appearance?: 'plain' | 'pill';
};

export function EmptyState({ children, appearance = 'plain' }: Props) {
	return <p className={cx(styles.empty, styles[appearance])}>{children}</p>;
}
