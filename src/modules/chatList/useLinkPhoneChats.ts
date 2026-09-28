// Хук: пока открыт экран чата, связывает чаты, созданные по номеру, с чатами в MAX.
// Вся логика — в linkPhoneChats.ts; хук только запускает её для текущего входа и останавливает.

import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { startLinkingPhoneChats } from './linkPhoneChats';

export function useLinkPhoneChats(): void {
	const credentials = useChatStore((state) => state.credentials);

	// Перезапуск — только при смене входа; новые чаты по номеру проверка замечает сама
	useEffect(() => (credentials ? startLinkingPhoneChats(credentials) : undefined), [credentials]);
}
