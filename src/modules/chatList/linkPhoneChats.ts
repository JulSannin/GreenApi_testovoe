// Связывание чатов, созданных по номеру, с чатами в MAX.
// MAX скрывает номера: в списке чатов и во входящих у собеседника часто нет номера, только id чата.
// Без связи чат по номеру (куда пишет пользователь) и чат по id (куда приходят ответы и история)
// выглядели бы как два разных чата с одним человеком. checkAccount по номеру возвращает id чата —
// связываем, и если дубль уже есть, он вливается в чат по номеру.
//
// Логика без React: проверка идёт по одному номеру за раз и сама следит за стором. Если бы её
// перезапускал эффект при каждом изменении списка, каждая связка обрывала бы уже отправленный
// запрос для следующего номера, и тот уходил бы на сервер дважды — а частые проверки GREEN-API
// считает подозрительными (ответ 469 и пауза на 2 часа).

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

// Следующий номер, который нужно проверить, — по текущему состоянию стора
function nextPhone(credentials: Credentials): string | undefined {
	const { chats } = useChatStore.getState();
	return Object.values(chats).find((chat) => needsLink(chat) && !checked(credentials).has(chat.id))
		?.id;
}

/**
 * Запускает связывание для этого входа: проверяет подходящие чаты по одному, а когда в сторе
 * появляются новые чаты по номеру — проверяет и их. Возвращает функцию остановки
 * (выход, уход с экрана): она обрывает текущий запрос и отписывается от стора.
 */
export function startLinkingPhoneChats(credentials: Credentials): () => void {
	const controller = new AbortController();
	let running = false;

	async function checkAll() {
		// Проверка уже идёт — новый номер она возьмёт сама: номера читаются из стора на каждом шаге
		if (running) return;
		running = true;
		try {
			for (;;) {
				if (controller.signal.aborted || limitedLogins.has(credentials)) return;
				const phone = nextPhone(credentials);
				if (!phone) return;
				await checkOne(phone);
			}
		} finally {
			running = false;
		}
	}

	async function checkOne(phone: string) {
		const { linkChat, markNoMaxAccount } = useChatStore.getState();
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
			// Остановили (выход, уход с экрана) — номер не помечаем: проверим в следующий раз
			if (controller.signal.aborted) return;
			checked(credentials).add(phone);
			if (error instanceof ApiError && error.status === CHECK_LIMIT_STATUS) {
				limitedLogins.add(credentials);
			}
			// Другие ошибки (сеть, номер не подходит для проверки) — не страшно:
			// чат работает и без связи, повторим после следующего входа
		}
	}

	void checkAll();
	// Новые чаты по номеру (создал пользователь, пришли из MAX) — тоже проверяем
	const unsubscribe = useChatStore.subscribe((state, previous) => {
		if (state.chats !== previous.chats) void checkAll();
	});

	return () => {
		controller.abort();
		unsubscribe();
	};
}
