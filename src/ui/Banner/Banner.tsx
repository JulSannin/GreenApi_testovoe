// Плашка-полоса над экраном: «нет связи», «сессия недействительна» и т. п.
// Где её поставить, решает страница: плашка стоит в потоке и сдвигает содержимое, а не закрывает его.
// info — сообщение без проблемы («настройки сохранены»),
// warning — проблема, которая может пройти сама или решается одной кнопкой,
// error — нужно действие пользователя (зачитывается сразу, перебивая).

import type { ReactNode } from 'react';
import { cx } from '@/ui/cx';
import styles from './Banner.module.css';

type Props = {
	tone: 'info' | 'warning' | 'error';
	children: ReactNode;
	// Кнопка справа, например «Выйти»
	action?: ReactNode;
};

export function Banner({ tone, children, action }: Props) {
	return (
		<div className={cx(styles.banner, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
			<p className={styles.text}>{children}</p>
			{action}
		</div>
	);
}
