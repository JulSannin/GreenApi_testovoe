// Кнопка с текстом.
// primary — главное действие («Войти»), secondary — второстепенное («Выйти»),
// link — выглядит как ссылка («Повторить», «Удалить» под сообщением).
// Размеры по MAX UI: md — 52px (форма входа), sm — 40px, xs — 32px (плашки, шапка).

import type { ComponentProps } from 'react';
import { cx } from '@/ui/cx';
import styles from './Button.module.css';

type Props = ComponentProps<'button'> & {
	variant?: 'primary' | 'secondary' | 'link';
	size?: 'md' | 'sm' | 'xs';
	// Растянуть на всю ширину родителя
	fullWidth?: boolean;
};

export function Button({
	variant = 'primary',
	size = 'md',
	fullWidth = false,
	// По умолчанию type="button": иначе кнопка внутри формы отправляла бы её
	type = 'button',
	className,
	...rest
}: Props) {
	return (
		<button
			type={type}
			className={cx(
				styles.button,
				styles[variant],
				variant !== 'link' && styles[size],
				fullWidth && styles.fullWidth,
				className,
			)}
			{...rest}
		/>
	);
}
