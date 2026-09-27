// Круглый аватар: буквы имени на цветном градиенте, а если букв нет — иконка человека.
// Цвет выбирается по colorKey (например, id чата): у одного ключа он всегда один и тот же.
// Аватар только украшает — рядом всегда есть имя, поэтому он скрыт от программ экранного доступа.

import { cx } from '@/ui/cx';
import styles from './Avatar.module.css';
import { avatarTone } from './avatarTone';

type Props = {
	// Одна-две буквы; пусто — иконка
	initials?: string;
	// От чего зависит цвет; без ключа — первый цвет
	colorKey?: string;
	// lg — 48px (список чатов), md — 40px (шапка чата)
	size?: 'md' | 'lg';
};

export function Avatar({ initials, colorKey = '', size = 'lg' }: Props) {
	if (!initials) {
		return (
			<span className={cx(styles.avatar, styles[size], styles.icon)} aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
				</svg>
			</span>
		);
	}

	return (
		<span
			className={cx(styles.avatar, styles[size], styles[`tone${avatarTone(colorKey)}`])}
			aria-hidden="true"
		>
			{initials}
		</span>
	);
}
