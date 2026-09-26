// Кнопка с текстом.
// primary — главное действие («Войти», «Создать»), secondary — второстепенное («Выйти»),
// link — выглядит как ссылка («Повторить», «Удалить» под сообщением).

import type { ComponentProps } from 'react';
import { cx } from '@/ui/cx';
import styles from './Button.module.css';

type Props = ComponentProps<'button'> & {
	variant?: 'primary' | 'secondary' | 'link';
	size?: 'md' | 'sm';
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
