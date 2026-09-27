// Однострочное поле ввода с рамкой фокуса.
// invalid подсвечивает поле красным и сообщает программам экранного доступа об ошибке.
// large — крупное поле (52px) для экрана входа; обычное — 40px.

import type { ComponentProps } from 'react';
import { cx } from '@/ui/cx';
import styles from './Input.module.css';

type Props = ComponentProps<'input'> & {
	invalid?: boolean;
	large?: boolean;
};

export function Input({ invalid = false, large = false, className, ...rest }: Props) {
	return (
		<input
			className={cx(styles.input, large && styles.large, className)}
			aria-invalid={invalid || undefined}
			{...rest}
		/>
	);
}
