// Левая панель: шапка, форма нового чата и список чатов.
// Кнопки в шапке (например, «Выйти» из модуля auth) передаёт страница через headerActions:
// модули не импортируют друг друга.

import type { ReactNode } from 'react';
import { useChatStore } from '@/store/chatStore';
import { PanelHeader } from '@/ui';
import { ChatList } from './ChatList';
import styles from './ChatSidebar.module.css';
import { NewChatForm } from './NewChatForm';

type Props = {
	headerActions?: ReactNode;
};

export function ChatSidebar({ headerActions }: Props) {
	const idInstance = useChatStore((state) => state.credentials?.idInstance);

	return (
		<div className={styles.sidebar}>
			<PanelHeader
				level={1}
				title="Чаты"
				subtitle={`Инстанс ${idInstance}`}
				after={headerActions}
			/>

			<NewChatForm />

			{/* Прокручивается только список, шапка и форма остаются на месте */}
			<div className={styles.chats}>
				<ChatList />
			</div>
		</div>
	);
}
