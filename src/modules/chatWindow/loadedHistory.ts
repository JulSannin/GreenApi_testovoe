// Какие чаты уже получили историю переписки — отдельно для каждого входа.
// При выходе сообщения стираются, поэтому после нового входа историю нужно загрузить заново.
// Ключ — объект данных входа: он живёт от входа до выхода, при следующем входе будет новый.
// WeakMap сам забывает список, когда данных входа больше нет.

import type { Credentials } from '@/api/types';

const loadedByLogin = new WeakMap<Credentials, Set<string>>();

function loadedChats(credentials: Credentials): Set<string> {
	let chats = loadedByLogin.get(credentials);
	if (!chats) {
		chats = new Set();
		loadedByLogin.set(credentials, chats);
	}
	return chats;
}

export function isHistoryLoaded(credentials: Credentials, chatKey: string): boolean {
	return loadedChats(credentials).has(chatKey);
}

export function markHistoryLoaded(credentials: Credentials, chatKey: string): void {
	loadedChats(credentials).add(chatKey);
}
