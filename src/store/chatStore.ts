// Глобальное состояние приложения на Zustand: данные входа, чаты и сообщения.
// Состояние сохраняется в localStorage (middleware persist), поэтому после перезагрузки
// страницы пользователь остаётся залогинен и видит свои чаты.

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Credentials } from '../api/types';
import { isValidPhone, normalizePhone, toChatId } from '../utils/phone';
import type { Chat, Message } from './types';

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
	addMessage: (chatKey: string, chatId: string, message: Message) => void;
};

const initialState: ChatState = {
	credentials: null,
	chats: {},
	messages: {},
	activeChatId: null,
};

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
			 */
			addMessage: (chatKey, chatId, message) =>
				set((state) => {
					const current = state.messages[chatKey] ?? [];
					// Возвращаем тот же объект state — Zustand увидит, что ничего не изменилось,
					// и не будет перерисовывать компоненты
					if (current.some((m) => m.id === message.id)) return state;

					const chat = state.chats[chatKey];
					return {
						chats: {
							...state.chats,
							[chatKey]: {
								id: chatKey,
								// У существующего чата адрес не меняем
								chatId: chat?.chatId ?? chatId,
								lastMessageAt: Math.max(chat?.lastMessageAt ?? 0, message.timestamp),
							},
						},
						// Добавляем в конец: сообщения приходят по порядку (очередь GREEN-API — FIFO)
						messages: { ...state.messages, [chatKey]: [...current, message] },
					};
				}),
		}),
		{
			// Ключ в localStorage
			name: 'green-api-chat',
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
