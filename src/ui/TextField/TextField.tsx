// Поле с подписью сверху. Подпись связана с полем через <label>,
// поэтому клик по ней ставит фокус в поле, а программа экранного доступа её прочитает.

import type { ComponentProps } from 'react';
import { Input } from '@/ui/Input/Input';
import styles from './TextField.module.css';

type Props = ComponentProps<typeof Input> & {
	label: string;
};

export function TextField({ label, ...inputProps }: Props) {
	return (
		<label className={styles.field}>
			<span className={styles.label}>{label}</span>
			<Input {...inputProps} />
		</label>
	);
}
