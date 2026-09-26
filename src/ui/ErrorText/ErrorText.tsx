// Текст ошибки. block — красная плашка (под формой входа), inline — просто красный текст.
// role="alert" — программа экранного доступа зачитает ошибку сразу, как она появится.

import type { ReactNode } from 'react';
import { cx } from '@/ui/cx';
import styles from './ErrorText.module.css';

type Props = {
	children: ReactNode;
	variant?: 'block' | 'inline';
	// Чтобы связать ошибку с полем через aria-describedby
	id?: string;
	className?: string;
};

export function ErrorText({ children, variant = 'inline', id, className }: Props) {
	return (
		<p id={id} role="alert" className={cx(styles.error, styles[variant], className)}>
			{children}
		</p>
	);
}
