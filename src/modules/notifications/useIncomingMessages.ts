// Хук: пока компонент на экране и пользователь вошёл, крутит цикл приёма
// и кладёт сообщения в стор. Возвращает состояние приёма для плашки.

import { useEffect, useState } from 'react';
import { findChatKeyByMaxId, useChatStore } from '@/store/chatStore';
import { resolveChatKey } from './parseNotification';
import { runNotificationLoop, type LoopStatus } from './runNotificationLoop';

export function useIncomingMessages(): LoopStatus {
	const credentials = useChatStore((state) => state.credentials);
	const [status, setStatus] = useState<LoopStatus>({ kind: 'ok' });

	useEffect(() => {
		if (!credentials) return;

		// Остановка цикла: controller.abort() обрывает висящий запрос и завершает while.
		// В режиме разработки React (StrictMode) монтирует эффект дважды —
		// первый цикл сразу останавливается, поэтому работает всегда ровно один
		const controller = new AbortController();

		void runNotificationLoop({
			credentials,
			signal: controller.signal,
			onMessage: (parsed) => {
				// getState() — берём стор на момент прихода сообщения, а не на момент запуска цикла
				const store = useChatStore.getState();
				const chatKey = resolveChatKey(parsed, (maxChatId) =>
					findChatKeyByMaxId(store.chats, maxChatId),
				);
				if (!chatKey) {
					if (import.meta.env.DEV) {
						console.debug(
							'[GREEN-API] сообщение с телефона в незнакомый чат — не показано:',
							parsed,
						);
					}
					return;
				}
				store.addMessage(chatKey, parsed.chatId, parsed.message, {
					name: parsed.name,
					maxChatId: parsed.maxChatId,
				});
			},
			onStatus: setStatus,
		});

		return () => controller.abort();
	}, [credentials]);

	return status;
}
