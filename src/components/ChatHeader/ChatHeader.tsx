// Шапка переписки: номер собеседника и, если передан onBack, кнопка «Назад».
// Только показ: когда нужна «Назад» и что она делает, решает страница.

import type { Chat } from '@/store/types';
import { IconButton, PanelHeader } from '@/ui';
import { chatTitle } from '@/utils/format';
import styles from './ChatHeader.module.css';

type Props = {
	chat: Chat;
	// Нет onBack — нет и кнопки «Назад»
	onBack?: () => void;
};

export function ChatHeader({ chat, onBack }: Props) {
	return (
		<PanelHeader
			title={chatTitle(chat)}
			before={
				onBack && (
					<IconButton className={styles.back} label="Назад к списку чатов" onClick={onBack}>
						<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
							<path
								d="M15 18l-6-6 6-6"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</IconButton>
				)
			}
		/>
	);
}
