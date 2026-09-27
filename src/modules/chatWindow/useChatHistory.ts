// Хук: при открытии чата загружает историю переписки (getChatHistory) и добавляет её в стор.
// Один раз на чат за вход: по документации у метода есть ограничение частоты запросов,
// а новые сообщения после загрузки и так приходят через цикл приёма.

import { useEffect, useState } from 'react';
import { getChatHistory } from '@/api/greenApi';
import { withTimeout } from '@/api/withTimeout';
import { useChatStore } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import { isHistoryLoaded, markHistoryLoaded } from './loadedHistory';
import { parseHistory } from './parseHistory';

// Сколько последних сообщений загружать (по документации по умолчанию — 100)
const HISTORY_COUNT = 100;
const REQUEST_TIMEOUT_MS = 15_000;

export type HistoryStatus = 'idle' | 'loading' | 'error';

export function useChatHistory(chat: Chat): HistoryStatus {
	const credentials = useChatStore((state) => state.credentials);
	const addMessages = useChatStore((state) => state.addMessages);
	const [status, setStatus] = useState<HistoryStatus>(() =>
		credentials && !isHistoryLoaded(credentials, chat.id) ? 'loading' : 'idle',
	);

	// Историю просим по id чата в MAX (по документации метод ждёт именно его).
	// Нет id — чата в MAX ещё нет (только что создан по номеру) и истории у него тоже нет.
	// Если id появится позже (догрузился список чатов MAX), эффект запустится заново
	const maxChatId = chat.maxChatId;

	useEffect(() => {
		if (!credentials || !maxChatId || isHistoryLoaded(credentials, chat.id)) return;
		// Переключились на другой чат — прошлый запрос больше не нужен
		const controller = new AbortController();

		withTimeout(controller.signal, REQUEST_TIMEOUT_MS, (signal) =>
			getChatHistory(credentials, maxChatId, HISTORY_COUNT, signal),
		)
			.then((data) => {
				markHistoryLoaded(credentials, chat.id);
				addMessages(chat.id, chat.chatId, parseHistory(data));
				setStatus('idle');
			})
			.catch(() => {
				// Ошибка не страшна: переписка работает и без истории. Попробуем снова в следующий раз
				if (!controller.signal.aborted) {
					setStatus('error');
				}
			});

		return () => controller.abort();
	}, [credentials, maxChatId, chat.id, chat.chatId, addMessages]);

	// Без id в MAX грузить нечего — никаких пометок про историю
	return maxChatId ? status : 'idle';
}
