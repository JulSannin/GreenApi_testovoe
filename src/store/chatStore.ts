// Глобальное состояние приложения на Zustand: данные входа, чаты и сообщения.
// Состояние сохраняется в localStorage (middleware persist), поэтому после перезагрузки
// страницы пользователь остаётся залогинен и видит свои чаты.

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Credentials } from '@/api/types';
import { isValidPhone, normalizePhone, toChatId } from '@/utils/phone';
import type { Chat, ChatInfo, Message } from './types';

type ChatState = {
	// Данные входа в GREEN-API; null — пользователь не вошёл
	credentials: Credentials | null;
	// Чаты по ключу: { '79991234567': { id, chatId, lastMessageAt } }
	chats: Record<string, Chat>;
	// Сообщения по ключу чата, от старых к новым
	messages: Record<string, Message[]>;
	// Ключ открытого чата; null — чат не выбран
	activeChatId: string | null;
};

type ChatActions = {
	login: (credentials: Credentials) => void;
	logout: () => void;
	createChat: (phone: string) => string | null;
	setActiveChat: (chatKey: string | null) => void;
	addMessage: (chatKey: string, chatId: string, message: Message, meta?: ChatMeta) => void;
	addMessages: (chatKey: string, chatId: string, messages: Message[]) => void;
	mergeChats: (chats: ChatInfo[]) => void;
	linkChat: (chatKey: string, maxChatId: string) => void;
	markNoMaxAccount: (chatKey: string) => void;
	updateMessage: (chatKey: string, messageId: string, patch: Partial<Message>) => void;
	confirmMessage: (chatKey: string, localId: string, idMessage: string) => void;
	removeMessage: (chatKey: string, messageId: string) => void;
};

// Что ещё известно о чате из сообщения: имя собеседника и id чата в MAX
type ChatMeta = Pick<ChatInfo, 'name' | 'maxChatId'>;

/**
 * Ключ чата по его id в MAX — или undefined, если такой чат ещё не известен.
 */
export function findChatKeyByMaxId(
	chats: Record<string, Chat>,
	maxChatId: string,
): string | undefined {
	return Object.values(chats).find((chat) => chat.maxChatId === maxChatId || chat.id === maxChatId)
		?.id;
}

// Чат с новыми сведениями. Существующему не меняем адрес для отправки;
// новое имя и id в MAX важнее старых (собеседник мог переименоваться), а без них старые сохраняются
function withChatInfo(chat: Chat | undefined, key: string, chatId: string, meta: ChatMeta): Chat {
	return {
		// Остальные поля чата (например, noMaxAccount) сохраняем как есть
		...chat,
		id: key,
		chatId: chat?.chatId ?? chatId,
		name: meta.name ?? chat?.name,
		maxChatId: meta.maxChatId ?? chat?.maxChatId,
		lastMessageAt: chat?.lastMessageAt ?? 0,
	};
}

// Два списка сообщений в один: без повторов (по id), по времени.
// Повторы отсекаются и внутри самой пачки added: сервер может прислать одно сообщение дважды
function mergeMessages(current: Message[], added: Message[]): Message[] {
	const known = new Set(current.map((m) => m.id));
	const fresh = added.filter((m) => {
		if (known.has(m.id)) return false;
		known.add(m.id);
		return true;
	});
	if (fresh.length === 0) return current;
	return [...current, ...fresh].sort((a, b) => a.timestamp - b.timestamp);
}

const initialState: ChatState = {
	credentials: null,
	chats: {},
	messages: {},
	activeChatId: null,
};

// Текст для сообщений, отправка которых оборвалась перезагрузкой страницы
export const INTERRUPTED_SEND_ERROR =
	'Отправка прервалась. Сообщение могло уйти — проверьте переписку в MAX перед повторной отправкой';

// Сообщения со статусом 'sending' после перезагрузки страницы помечаются неотправленными:
// ответа сервера на них уже не будет, и без этого они навсегда остались бы «отправляется»
function failInterruptedMessages(messages: Record<string, Message[]>): Record<string, Message[]> {
	return Object.fromEntries(
		Object.entries(messages).map(([chatKey, list]) => [
			chatKey,
			list.map((m) =>
				m.status === 'sending' ? { ...m, status: 'failed', error: INTERRUPTED_SEND_ERROR } : m,
			),
		]),
	);
}

// create<Тип>()(...) — двойные скобки нужны Zustand для правильного вывода типов вместе с persist
export const useChatStore = create<ChatState & ChatActions>()(
	persist(
		(set) => ({
			...initialState,

			// Сохраняет данные входа. Проверка через getStateInstance — на экране входа, до вызова login
			login: (credentials) => set({ credentials }),

			// Выход: возвращаем всё к начальному состоянию, persist перезапишет localStorage
			logout: () => set(initialState),

			/**
			 * Открывает чат с номером phone; если такого чата ещё нет — создаёт его.
			 * Номер нормализуется, поэтому '+7 999 123-45-67' и '89991234567' — один и тот же чат.
			 * Возвращает ключ чата или null, если номер некорректный (тогда ничего не меняется).
			 * Форма тоже проверяет номер, чтобы показать ошибку, — здесь последняя линия защиты.
			 */
			createChat: (phone) => {
				const id = normalizePhone(phone);
				if (!isValidPhone(id)) return null;

				set((state) => ({
					chats: state.chats[id]
						? state.chats
						: {
								...state.chats,
								[id]: { id, chatId: toChatId(id), lastMessageAt: Date.now() },
							},
					activeChatId: id,
				}));
				return id;
			},

			setActiveChat: (chatKey) => set({ activeChatId: chatKey }),

			/**
			 * Добавляет сообщение в чат chatKey.
			 * - Сообщение с уже известным id пропускается: одно и то же уведомление может прийти дважды.
			 * - Если чата нет (первое входящее от нового собеседника), он создаётся с адресом chatId.
			 *   chatId передаётся отдельно: по одному ключу из цифр не понять,
			 *   номер это или id чата в MAX, а адрес для отправки у них разный.
			 * - Обновляет lastMessageAt, чтобы чат поднялся вверх списка.
			 * - meta — что ещё известно из сообщения: имя собеседника (чтобы в списке было «Иван»,
			 *   а не только номер) и id чата в MAX (чтобы потом найти чат, когда номера нет).
			 */
			addMessage: (chatKey, chatId, message, meta = {}) =>
				set((state) => {
					const current = state.messages[chatKey] ?? [];
					// Возвращаем тот же объект state — Zustand увидит, что ничего не изменилось,
					// и не будет перерисовывать компоненты
					if (current.some((m) => m.id === message.id)) return state;

					const chat = withChatInfo(state.chats[chatKey], chatKey, chatId, meta);
					return {
						chats: {
							...state.chats,
							[chatKey]: {
								...chat,
								lastMessageAt: Math.max(chat.lastMessageAt, message.timestamp),
							},
						},
						// Добавляем в конец: сообщения приходят по порядку (очередь GREEN-API — FIFO)
						messages: { ...state.messages, [chatKey]: [...current, message] },
					};
				}),

			/**
			 * Добавляет пачку сообщений (историю переписки) в чат chatKey.
			 * Уже известные (по id) пропускаются; всё вместе сортируется по времени:
			 * история старше того, что пришло или отправлено за этот сеанс.
			 */
			addMessages: (chatKey, chatId, messages) =>
				set((state) => {
					const current = state.messages[chatKey] ?? [];
					const merged = mergeMessages(current, messages);
					if (merged === current) return state;

					const chat = withChatInfo(state.chats[chatKey], chatKey, chatId, {});
					return {
						chats: {
							...state.chats,
							[chatKey]: {
								...chat,
								lastMessageAt: Math.max(chat.lastMessageAt, merged.at(-1)!.timestamp),
							},
						},
						messages: { ...state.messages, [chatKey]: merged },
					};
				}),

			/**
			 * Дополняет список чатов чатами из MAX (getChats): новые заводятся без сообщений,
			 * у известных обновляются имя и id в MAX. Сообщения не трогаются.
			 * Известный чат ищется сначала по id в MAX: если он уже заведён под другим ключом
			 * (например, по id, пока номер был скрыт), второй чат с тем же человеком не появится.
			 */
			mergeChats: (chats) =>
				set((state) => {
					if (chats.length === 0) return state;
					const next = { ...state.chats };
					for (const info of chats) {
						const key = (info.maxChatId && findChatKeyByMaxId(next, info.maxChatId)) || info.key;
						next[key] = withChatInfo(next[key], key, info.chatId, info);
					}
					return { chats: next };
				}),

			/**
			 * Связывает чат с его id в MAX (узнали через checkAccount).
			 * Если под этим id уже есть другой чат — это тот же собеседник: MAX скрывает номера,
			 * поэтому раньше его было не опознать. Такой чат вливается в chatKey:
			 * сообщения объединяются без повторов, имя переходит, если своего нет,
			 * а если он был открыт — открытым становится chatKey.
			 */
			linkChat: (chatKey, maxChatId) =>
				set((state) => {
					const chat = state.chats[chatKey];
					if (!chat) return state;

					const duplicate = Object.values(state.chats).find(
						(other) =>
							other.id !== chatKey && (other.maxChatId === maxChatId || other.id === maxChatId),
					);
					if (!duplicate && chat.maxChatId === maxChatId) return state;

					const chats = {
						...state.chats,
						[chatKey]: {
							...chat,
							maxChatId,
							name: chat.name ?? duplicate?.name,
							lastMessageAt: Math.max(chat.lastMessageAt, duplicate?.lastMessageAt ?? 0),
						},
					};
					const messages = { ...state.messages };
					if (duplicate) {
						messages[chatKey] = mergeMessages(
							state.messages[chatKey] ?? [],
							state.messages[duplicate.id] ?? [],
						);
						delete chats[duplicate.id];
						delete messages[duplicate.id];
					}

					return {
						chats,
						messages,
						activeChatId: state.activeChatId === duplicate?.id ? chatKey : state.activeChatId,
					};
				}),

			// checkAccount показал, что у номера нет аккаунта MAX — больше его не проверяем
			markNoMaxAccount: (chatKey) =>
				set((state) => {
					const chat = state.chats[chatKey];
					if (!chat || chat.noMaxAccount) return state;
					return { chats: { ...state.chats, [chatKey]: { ...chat, noMaxAccount: true } } };
				}),

			/**
			 * Меняет поля сообщения, например статус: 'failed' → 'sending' при повторной отправке.
			 * Если сообщения нет (скажем, пользователь вышел, пока шла отправка) — ничего не делает.
			 */
			updateMessage: (chatKey, messageId, patch) =>
				set((state) => {
					const list = state.messages[chatKey];
					if (!list?.some((m) => m.id === messageId)) return state;
					return {
						messages: {
							...state.messages,
							[chatKey]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
						},
					};
				}),

			/**
			 * Сервер принял сообщение: заменяем временный id настоящим idMessage и ставим статус 'sent'.
			 * Если сообщение с таким idMessage уже есть (успело прийти уведомлением) — временное удаляем,
			 * чтобы не было дубля.
			 */
			confirmMessage: (chatKey, localId, idMessage) =>
				set((state) => {
					const list = state.messages[chatKey];
					if (!list?.some((m) => m.id === localId)) return state;

					const alreadyKnown = list.some((m) => m.id === idMessage);
					return {
						messages: {
							...state.messages,
							[chatKey]: alreadyKnown
								? list.filter((m) => m.id !== localId)
								: list.map((m) =>
										m.id === localId
											? { ...m, id: idMessage, status: 'sent', error: undefined }
											: m,
									),
						},
					};
				}),

			// Удаляет сообщение из чата (кнопка «Удалить» у неотправленного)
			removeMessage: (chatKey, messageId) =>
				set((state) => {
					const list = state.messages[chatKey];
					if (!list?.some((m) => m.id === messageId)) return state;
					return {
						messages: { ...state.messages, [chatKey]: list.filter((m) => m.id !== messageId) },
					};
				}),
		}),
		{
			// Ключ в localStorage
			name: 'green-api-chat',
			// Как соединить сохранённое состояние с начальным при загрузке страницы.
			// По умолчанию — просто { ...начальное, ...сохранённое }; дополнительно помечаем
			// прерванные отправки неотправленными
			merge: (persisted, current) => {
				const saved = persisted as Partial<ChatState> | undefined;
				return {
					...current,
					...saved,
					messages: failInterruptedMessages(saved?.messages ?? current.messages),
				};
			},
		},
	),
);

// ---------- Хуки-селекторы для компонентов ----------
// Селектор не должен создавать новый массив или объект при каждом вызове:
// Zustand сравнивает результат с прошлым, и новый объект каждый раз = бесконечные перерисовки.

// Общий пустой массив для чатов без сообщений (вместо нового [] на каждый вызов)
const EMPTY_MESSAGES: Message[] = [];

// Сообщения чата; для несуществующего чата или null — пустой массив
export function useChatMessages(chatKey: string | null): Message[] {
	return useChatStore((state) => (chatKey ? state.messages[chatKey] : undefined) ?? EMPTY_MESSAGES);
}

// Последнее сообщение чата для строки списка. at(-1) возвращает уже существующий объект,
// поэтому новых объектов не создаётся
export function useLastMessage(chatKey: string): Message | undefined {
	return useChatStore((state) => state.messages[chatKey]?.at(-1));
}

// Открытый чат или null
export function useActiveChat(): Chat | null {
	return useChatStore((state) =>
		state.activeChatId ? (state.chats[state.activeChatId] ?? null) : null,
	);
}

// Чаты для списка, новые сверху. Сортируем в useMemo, а не в селекторе:
// пересчёт только когда меняется объект chats
export function useSortedChats(): Chat[] {
	const chats = useChatStore((state) => state.chats);
	return useMemo(
		() => Object.values(chats).sort((a, b) => b.lastMessageAt - a.lastMessageAt),
		[chats],
	);
}
