// Хук: связывает чаты, созданные по номеру, с чатами в MAX.
// MAX скрывает номера: в списке чатов и во входящих у собеседника часто нет номера, только id чата.
// Без связи чат по номеру (куда пишет пользователь) и чат по id (куда приходят ответы и история)
// выглядели бы как два разных чата с одним человеком. checkAccount по номеру возвращает id чата —
// связываем, и если дубль уже есть, он вливается в чат по номеру.

import { useEffect } from 'react';
import { ApiError, checkAccount } from '@/api/greenApi';
import type { Credentials } from '@/api/types';
import { withTimeout } from '@/api/withTimeout';
import { useChatStore } from '@/store/chatStore';
import type { Chat } from '@/store/types';
import { parseCheckAccount } from './parseCheckAccount';

const REQUEST_TIMEOUT_MS = 15_000;

// По документации 469 — превышен лимит проверок, нужна пауза на 2 часа
const CHECK_LIMIT_STATUS = 469;

// Нужна ли проверка: чат по номеру, id в MAX ещё не известен и номер не отмечен как «нет в MAX»
function needsLink(chat: Chat): boolean {
	return chat.chatId.endsWith('@c.us') && !chat.maxChatId && !chat.noMaxAccount;
}

// Какие номера уже проверяли за этот вход (в том числе с ошибкой) — чтобы не проверять по кругу.
// Отдельно для каждого входа, как и загруженная история
const checkedByLogin = new WeakMap<Credentials, Set<string>>();
// Входы, для которых сервер ответил 469: до конца сеанса больше не проверяем
const limitedLogins = new WeakSet<Credentials>();

function checked(credentials: Credentials): Set<string> {
	let set = checkedByLogin.get(credentials);
	if (!set) {
		set = new Set();
		checkedByLogin.set(credentials, set);
	}
	return set;
}

export function useLinkPhoneChats(): void {
	const credentials = useChatStore((state) => state.credentials);
	const linkChat = useChatStore((state) => state.linkChat);
	const markNoMaxAccount = useChatStore((state) => state.markNoMaxAccount);
	// Ключи чатов, которые нужно проверить, одной строкой: строка сравнивается по значению,
	// поэтому эффект перезапускается, только когда список действительно изменился
	const pending = useChatStore((state) =>
		Object.values(state.chats)
			.filter(needsLink)
			.map((chat) => chat.id)
			.join(','),
	);

	useEffect(() => {
		if (!credentials || !pending || limitedLogins.has(credentials)) return;
		const controller = new AbortController();

		void (async () => {
			// По одному: номеров немного, а частые проверки GREEN-API не любит
			for (const phone of pending.split(',')) {
				if (controller.signal.aborted || limitedLogins.has(credentials)) return;
				if (checked(credentials).has(phone)) continue;

				try {
					const data = await withTimeout(controller.signal, REQUEST_TIMEOUT_MS, (signal) =>
						checkAccount(credentials, phone, signal),
					);
					const result = parseCheckAccount(data);
					if (result?.exist && result.chatId) {
						linkChat(phone, result.chatId);
					} else if (result && !result.exist) {
						markNoMaxAccount(phone);
					}
					checked(credentials).add(phone);
				} catch (error) {
					// Остановили (ушли с экрана или список изменился) — проверим в следующий раз
					if (controller.signal.aborted) return;
					checked(credentials).add(phone);
					if (error instanceof ApiError && error.status === CHECK_LIMIT_STATUS) {
						limitedLogins.add(credentials);
						return;
					}
					// Другие ошибки (сеть, номер не подходит для проверки) — не страшно:
					// чат работает и без связи, повторим после следующего входа
				}
			}
		})();

		return () => controller.abort();
	}, [credentials, pending, linkChat, markNoMaxAccount]);
}
