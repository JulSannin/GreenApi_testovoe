// Кнопка с иконкой («Отправить», «Назад»): primary — 40px, ghost — 32px.
// label обязателен: у кнопки без текста это единственное, что прочитает программа экранного доступа.

import type { ComponentProps } from 'react';
import { cx } from '@/ui/cx';
import styles from './IconButton.module.css';

type Props = Omit<ComponentProps<'button'>, 'aria-label'> & {
	label: string;
	// primary — залитая акцентным цветом, ghost — прозрачная
	variant?: 'primary' | 'ghost';
};

export function IconButton({
	label,
	variant = 'ghost',
	type = 'button',
	className,
	children,
	...rest
}: Props) {
	return (
		<button
			type={type}
			aria-label={label}
			className={cx(styles.button, styles[variant], className)}
			{...rest}
		>
			{children}
		</button>
	);
}
