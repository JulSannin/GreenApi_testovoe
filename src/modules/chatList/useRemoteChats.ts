// Хук: при открытии экрана чата загружает список чатов из MAX (getChats) и дополняет им стор.
// reload() — загрузить заново (кнопка «Обновить»).

import { useEffect, useState } from 'react';
import { getChats } from '@/api/greenApi';
import { withTimeout } from '@/api/withTimeout';
import { useChatStore } from '@/store/chatStore';
import { parseChats } from './parseChats';

const REQUEST_TIMEOUT_MS = 15_000;

export type RemoteChatsStatus = 'loading' | 'loaded' | 'error';

export function useRemoteChats() {
	const credentials = useChatStore((state) => state.credentials);
	const mergeChats = useChatStore((state) => state.mergeChats);
	const [status, setStatus] = useState<RemoteChatsStatus>('loading');
	// Меняется при нажатии «Обновить» — эффект запускается заново
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!credentials) return;
		// Ушли с экрана или нажали «Обновить» ещё раз — прошлый запрос больше не нужен
		const controller = new AbortController();

		withTimeout(controller.signal, REQUEST_TIMEOUT_MS, (signal) => getChats(credentials, signal))
			.then((data) => {
				mergeChats(parseChats(data));
				setStatus('loaded');
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setStatus('error');
				}
			});

		return () => controller.abort();
	}, [credentials, attempt, mergeChats]);

	function reload() {
		setStatus('loading');
		setAttempt((n) => n + 1);
	}

	return { status, reload };
}
