// Круглый аватар с силуэтом человека. Только украшение — программы экранного доступа его пропускают.

import styles from './Avatar.module.css';

export function Avatar() {
	return (
		<span className={styles.avatar} aria-hidden="true">
			<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
				<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
			</svg>
		</span>
	);
}
