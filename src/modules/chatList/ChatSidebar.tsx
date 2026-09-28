// Левая панель: шапка, форма нового чата и список чатов (свои + загруженные из MAX).
// Кнопки в шапке (например, «Выйти» из модуля auth) передаёт страница через headerActions:
// модули не импортируют друг друга.

import type { ReactNode } from 'react';
import { ErrorText, IconButton, PanelHeader } from '@/ui';
import { ChatList } from './ChatList';
import styles from './ChatSidebar.module.css';
import { NewChatForm } from './NewChatForm';
import { useLinkPhoneChats } from './useLinkPhoneChats';
import { useRemoteChats } from './useRemoteChats';

type Props = {
	headerActions?: ReactNode;
};

export function ChatSidebar({ headerActions }: Props) {
	const remoteChats = useRemoteChats();
	const isLoading = remoteChats.status === 'loading';
	// Чаты, созданные по номеру, связываем с чатами в MAX — чтобы ответы и история попадали в них
	useLinkPhoneChats();

	return (
		<div className={styles.sidebar}>
			<PanelHeader
				level={1}
				title="Чаты"
				after={
					<div className={styles.actions}>
						<IconButton
							label="Обновить список чатов"
							onClick={remoteChats.reload}
							disabled={isLoading}
							// Пока идёт загрузка, иконка крутится
							className={isLoading ? styles.spinning : undefined}
						>
							<svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
								<path
									d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</IconButton>
						{headerActions}
					</div>
				}
			/>

			<NewChatForm />

			{remoteChats.status === 'error' && (
				<ErrorText className={styles.error}>
					Не удалось загрузить чаты из MAX. Нажмите «Обновить» наверху
				</ErrorText>
			)}

			{/* Прокручивается только список, шапка и форма остаются на месте */}
			<div className={styles.chats}>
				<ChatList isLoading={isLoading} />
			</div>
		</div>
	);
}
