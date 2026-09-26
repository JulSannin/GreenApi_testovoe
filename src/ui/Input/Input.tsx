// Однострочное поле ввода с рамкой фокуса.
// invalid подсвечивает поле красным и сообщает программам экранного доступа об ошибке.

import type { ComponentProps } from 'react';
import { cx } from '@/ui/cx';
import styles from './Input.module.css';

type Props = ComponentProps<'input'> & {
	invalid?: boolean;
};

export function Input({ invalid = false, className, ...rest }: Props) {
	return (
		<input className={cx(styles.input, className)} aria-invalid={invalid || undefined} {...rest} />
	);
}
