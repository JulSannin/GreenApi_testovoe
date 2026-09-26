// Шапка переписки: номер собеседника. На телефоне ещё кнопка «Назад» к списку чатов.
// Только показ: что делает «Назад», решает модуль через onBack.

import type { Chat } from '@/store/types';
import { IconButton, PanelHeader } from '@/ui';
import { chatTitle } from '@/utils/format';
import styles from './ChatHeader.module.css';

type Props = {
	chat: Chat;
	onBack: () => void;
};

export function ChatHeader({ chat, onBack }: Props) {
	return (
		<PanelHeader
			title={chatTitle(chat)}
			before={
				// Обёртка прячет кнопку на компьютере — см. ChatHeader.module.css
				<div className={styles.back}>
					<IconButton label="Назад к списку чатов" onClick={onBack}>
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
				</div>
			}
		/>
	);
}
