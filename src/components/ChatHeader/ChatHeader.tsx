// Шапка переписки: аватар, имя собеседника (под ним номер) или просто номер,
// и, если передан onBack, кнопка «Назад».
// Только показ: когда нужна «Назад» и что она делает, решает страница.

import type { Chat } from '@/store/types';
import { Avatar, IconButton, PanelHeader } from '@/ui';
import { chatAddress, chatTitle, initials } from '@/utils/format';
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
			// Если в заголовке имя — номер показываем строкой ниже
			subtitle={chat.name?.trim() ? chatAddress(chat) : undefined}
			before={
				<>
					{onBack && (
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
					)}
					{/* Тот же аватар, что в списке чатов: цвет по тому же ключу */}
					<Avatar initials={initials(chat.name)} colorKey={chat.id} size="md" />
				</>
			}
		/>
	);
}
