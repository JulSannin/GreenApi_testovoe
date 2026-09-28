// Тесты связывания чатов по номеру с чатами MAX. fetch подменяется заглушкой, которая отвечает
// на checkAccount по номеру из тела запроса; стор — настоящий.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credentials } from '@/api/types';
import { useChatStore } from '@/store/chatStore';
import { startLinkingPhoneChats } from './linkPhoneChats';

const fetchMock = vi.fn<typeof fetch>();
const store = () => useChatStore.getState();

// Номера, у которых есть аккаунт MAX: номер → id чата
let accounts: Record<string, string>;
// Номера, которые проверил «сервер», по порядку
let requested: string[];
// Статус, которым сервер ответит на следующий запрос (например, 469)
let nextStatus: number | null;
let credentials: Credentials;
let stop: () => void;

beforeEach(() => {
	accounts = {};
	requested = [];
	nextStatus = null;
	// Для каждого теста — новый объект данных входа: как новый вход, со своими «уже проверено»
	credentials = {
		apiUrl: 'https://api.example.com',
		idInstance: '3100000001',
		apiTokenInstance: 't',
	};
	fetchMock.mockImplementation(async (_url, init) => {
		const phone = String(JSON.parse(init?.body as string).phoneNumber);
		requested.push(phone);
		if (nextStatus) {
			const status = nextStatus;
			nextStatus = null;
			return new Response('', { status });
		}
		const chatId = accounts[phone];
		return new Response(JSON.stringify(chatId ? { exist: true, chatId } : { exist: false }));
	});
	vi.stubGlobal('fetch', fetchMock);
	useChatStore.setState(useChatStore.getInitialState(), true);
	store().login(credentials);
});

afterEach(() => {
	stop?.();
	fetchMock.mockReset();
	vi.unstubAllGlobals();
});

describe('startLinkingPhoneChats', () => {
	it('проверяет каждый номер ровно один раз и связывает найденные', async () => {
		accounts = { '79990000001': '100' };
		store().createChat('79990000001');
		store().createChat('79990000002');
		store().createChat('79990000003');

		stop = startLinkingPhoneChats(credentials);

		await vi.waitFor(() => expect(requested).toHaveLength(3));
		// Каждая связка меняет стор — но уже отправленные запросы не повторяются
		expect([...requested].sort()).toEqual(['79990000001', '79990000002', '79990000003']);
		expect(store().chats['79990000001'].maxChatId).toBe('100');
		expect(store().chats['79990000002'].noMaxAccount).toBe(true);
		expect(store().chats['79990000003'].noMaxAccount).toBe(true);
	});

	it('проверяет чат по номеру, созданный позже', async () => {
		store().createChat('79990000001');
		stop = startLinkingPhoneChats(credentials);
		await vi.waitFor(() => expect(requested).toHaveLength(1));

		accounts = { '79990000002': '200' };
		store().createChat('79990000002');

		await vi.waitFor(() => expect(store().chats['79990000002'].maxChatId).toBe('200'));
		expect(requested).toEqual(['79990000001', '79990000002']);
	});

	it('чаты, уже связанные или без аккаунта MAX, не проверяет', async () => {
		store().createChat('79990000001');
		store().linkChat('79990000001', '100');
		store().createChat('79990000002');
		store().markNoMaxAccount('79990000002');

		stop = startLinkingPhoneChats(credentials);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(requested).toEqual([]);
	});

	it('после 469 до конца сеанса больше не проверяет', async () => {
		nextStatus = 469;
		store().createChat('79990000001');
		store().createChat('79990000002');

		stop = startLinkingPhoneChats(credentials);
		await vi.waitFor(() => expect(requested).toHaveLength(1));
		store().createChat('79990000003');
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(requested).toHaveLength(1);
	});

	it('после остановки новые чаты не проверяет', async () => {
		stop = startLinkingPhoneChats(credentials);
		stop();

		store().createChat('79990000001');
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(requested).toEqual([]);
	});
});
