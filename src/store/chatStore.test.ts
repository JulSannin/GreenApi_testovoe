// Тесты логики стора. React здесь не нужен: экшены вызываются напрямую через getState(),
// а результат читается оттуда же.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credentials } from '@/api/types';
import { findChatKeyByMaxId, INTERRUPTED_SEND_ERROR, useChatStore } from './chatStore';
import type { Message } from './types';

const credentials: Credentials = {
	apiUrl: 'https://api.example.com',
	idInstance: '3100000001',
	apiTokenInstance: 'token123',
};

// Короткий доступ к текущему состоянию и экшенам
const store = () => useChatStore.getState();

// Сообщение для тестов; нужные поля можно переопределить
function message(overrides: Partial<Message> = {}): Message {
	return { id: 'msg-1', text: 'Привет', direction: 'out', timestamp: 1_000, ...overrides };
}

// Перед каждым тестом возвращаем стор к начальному состоянию, чтобы тесты не влияли друг на друга
beforeEach(() => {
	useChatStore.setState(useChatStore.getInitialState(), true);
});

describe('login / logout', () => {
	it('login сохраняет данные входа', () => {
		store().login(credentials);

		expect(store().credentials).toEqual(credentials);
	});

	it('logout очищает всё', () => {
		store().login(credentials);
		store().createChat('79991234567');
		store().addMessage('79991234567', '79991234567@c.us', message());

		store().logout();

		expect(store().credentials).toBeNull();
		expect(store().chats).toEqual({});
		expect(store().messages).toEqual({});
		expect(store().activeChatId).toBeNull();
	});
});

describe('createChat', () => {
	it('создаёт чат с адресом для sendMessage, делает его активным и возвращает ключ', () => {
		const id = store().createChat('+7 (999) 123-45-67');

		expect(id).toBe('79991234567');
		expect(store().chats['79991234567']).toMatchObject({
			id: '79991234567',
			chatId: '79991234567@c.us',
		});
		expect(store().activeChatId).toBe('79991234567');
	});

	it('возвращает null и ничего не меняет при некорректном номере', () => {
		store().createChat('79991234567');
		const before = store();

		expect(store().createChat('')).toBeNull();
		expect(store().createChat('123')).toBeNull();
		// Городской номер без кода страны
		expect(store().createChat('495 123-45-67')).toBeNull();

		expect(store()).toBe(before);
	});

	it('добавляет 7 к номеру без кода страны', () => {
		expect(store().createChat('999 123-45-67')).toBe('79991234567');
	});

	it('не создаёт второй чат для того же номера в другой записи', () => {
		store().createChat('+7 999 123-45-67');
		store().createChat('89991234567');

		expect(Object.keys(store().chats)).toEqual(['79991234567']);
	});

	it('не трогает уже существующий чат', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ timestamp: 5_000 }));
		const before = store().chats['79991234567'];

		store().createChat('79991234567');

		expect(store().chats['79991234567']).toBe(before);
	});
});

describe('setActiveChat', () => {
	it('переключает открытый чат и умеет сбрасывать его', () => {
		store().createChat('79991234567');
		store().createChat('79990000000');

		store().setActiveChat('79991234567');
		expect(store().activeChatId).toBe('79991234567');

		store().setActiveChat(null);
		expect(store().activeChatId).toBeNull();
	});
});

describe('addMessage', () => {
	it('добавляет сообщения по порядку и обновляет lastMessageAt', () => {
		store().createChat('79991234567');

		store().addMessage(
			'79991234567',
			'79991234567@c.us',
			message({ id: 'a', timestamp: Date.now() + 1_000 }),
		);
		store().addMessage(
			'79991234567',
			'79991234567@c.us',
			message({ id: 'b', timestamp: Date.now() + 2_000 }),
		);

		expect(store().messages['79991234567'].map((m) => m.id)).toEqual(['a', 'b']);
		expect(store().chats['79991234567'].lastMessageAt).toBe(
			store().messages['79991234567'][1].timestamp,
		);
	});

	it('пропускает дубль с тем же id и не меняет состояние', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'a' }));
		const before = store();

		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'a', text: 'Другой' }));

		// Тот же объект состояния — значит, компоненты не перерисуются
		expect(store()).toBe(before);
		expect(store().messages['79991234567']).toHaveLength(1);
	});

	it('создаёт чат, если это первое сообщение от нового собеседника', () => {
		// Номер во входящем не пришёл — ключ и адрес берутся из id чата в MAX
		store().addMessage('10000000', '10000000', message({ direction: 'in', timestamp: 7_000 }));

		expect(store().chats['10000000']).toEqual({
			id: '10000000',
			chatId: '10000000',
			lastMessageAt: 7_000,
		});
	});

	it('не меняет адрес у существующего чата', () => {
		store().createChat('79991234567');

		store().addMessage('79991234567', '10000000', message({ direction: 'in' }));

		expect(store().chats['79991234567'].chatId).toBe('79991234567@c.us');
	});

	it('не открывает чат при входящем сообщении', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ direction: 'in' }));

		expect(store().activeChatId).toBeNull();
	});

	it('записывает имя собеседника и id чата в MAX в чат, созданный по номеру', () => {
		store().createChat('79991234567');

		store().addMessage('79991234567', '10000000', message({ direction: 'in' }), {
			name: 'Иван',
			maxChatId: '10000000',
		});

		expect(store().chats['79991234567']).toMatchObject({
			name: 'Иван',
			maxChatId: '10000000',
			chatId: '79991234567@c.us',
		});
	});

	it('обновляет имя, если собеседник переименовался, и не стирает его без нового', () => {
		const chatId = '79991234567@c.us';
		store().addMessage('79991234567', chatId, message({ id: 'a' }), { name: 'Иван' });
		store().addMessage('79991234567', chatId, message({ id: 'b' }), { name: 'Иван Петров' });
		store().addMessage('79991234567', chatId, message({ id: 'c' }));

		expect(store().chats['79991234567'].name).toBe('Иван Петров');
	});
});

describe('addMessages (история переписки)', () => {
	it('добавляет пачку, пропускает известные и сортирует по времени', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'new', timestamp: 3_000 }));

		store().addMessages('79991234567', '79991234567@c.us', [
			message({ id: 'old-2', timestamp: 2_000 }),
			message({ id: 'new', timestamp: 3_000 }),
			message({ id: 'old-1', timestamp: 1_000 }),
		]);

		expect(store().messages['79991234567'].map((m) => m.id)).toEqual(['old-1', 'old-2', 'new']);
		expect(store().chats['79991234567'].lastMessageAt).toBe(3_000);
	});

	it('заводит чат, если его ещё нет', () => {
		store().addMessages('10000000', '10000000', [message({ id: 'a', timestamp: 5_000 })]);

		expect(store().chats['10000000']).toMatchObject({ chatId: '10000000', lastMessageAt: 5_000 });
	});

	it('если всё уже известно — состояние не меняется', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'a' }));
		const before = store();

		store().addMessages('79991234567', '79991234567@c.us', [message({ id: 'a' })]);

		expect(store()).toBe(before);
	});
});

describe('mergeChats (чаты из MAX)', () => {
	it('заводит новые чаты без сообщений и без времени', () => {
		store().mergeChats([
			{ key: '79876543210', chatId: '79876543210@c.us', maxChatId: '10000000', name: 'Иван' },
		]);

		expect(store().chats['79876543210']).toEqual({
			id: '79876543210',
			chatId: '79876543210@c.us',
			maxChatId: '10000000',
			name: 'Иван',
			lastMessageAt: 0,
		});
		expect(store().messages['79876543210']).toBeUndefined();
	});

	it('у известного чата обновляет имя и id в MAX, а адрес, время и сообщения не трогает', () => {
		store().createChat('79876543210');
		store().addMessage('79876543210', '79876543210@c.us', message({ timestamp: 5_000 }));

		store().mergeChats([
			{ key: '79876543210', chatId: '10000000', maxChatId: '10000000', name: 'Иван' },
		]);

		expect(store().chats['79876543210']).toMatchObject({
			chatId: '79876543210@c.us',
			maxChatId: '10000000',
			name: 'Иван',
		});
		expect(store().chats['79876543210'].lastMessageAt).toBeGreaterThanOrEqual(5_000);
		expect(store().messages['79876543210']).toHaveLength(1);
	});
});

describe('mergeChats: один человек — один чат', () => {
	it('чат заведён по id в MAX (номер был скрыт), теперь номер виден — второй чат не появляется', () => {
		store().addMessage('10000000', '10000000', message({ id: 'a' }), { maxChatId: '10000000' });

		store().mergeChats([
			{ key: '79876543210', chatId: '79876543210@c.us', maxChatId: '10000000', name: 'Анна' },
		]);

		expect(Object.keys(store().chats)).toEqual(['10000000']);
		expect(store().chats['10000000']).toMatchObject({ name: 'Анна', maxChatId: '10000000' });
		expect(store().messages['10000000']).toHaveLength(1);
	});
});

describe('linkChat (id в MAX узнали через checkAccount)', () => {
	// Как было у пользователя: чат по номеру (только свои сообщения)
	// и тот же собеседник из списка MAX со скрытым номером (история и входящие)
	function twoChatsForOnePerson() {
		store().createChat('79235268075');
		store().addMessage(
			'79235268075',
			'79235268075@c.us',
			message({ id: 'out-1', timestamp: 1_000 }),
		);
		store().mergeChats([
			{ key: '464953623', chatId: '464953623', maxChatId: '464953623', name: 'Никита' },
		]);
		store().addMessages('464953623', '464953623', [
			message({ id: 'out-1', timestamp: 1_000 }),
			message({ id: 'in-1', direction: 'in', timestamp: 2_000 }),
		]);
	}

	it('сливает чат из MAX в чат по номеру: один чат, все сообщения, имя из MAX', () => {
		twoChatsForOnePerson();

		store().linkChat('79235268075', '464953623');

		expect(Object.keys(store().chats)).toEqual(['79235268075']);
		expect(store().chats['79235268075']).toMatchObject({
			chatId: '79235268075@c.us',
			maxChatId: '464953623',
			name: 'Никита',
			lastMessageAt: expect.any(Number),
		});
		expect(store().messages['79235268075'].map((m) => m.id)).toEqual(['out-1', 'in-1']);
		expect(store().messages['464953623']).toBeUndefined();
	});

	it('если был открыт чат из MAX — открытым становится объединённый', () => {
		twoChatsForOnePerson();
		store().setActiveChat('464953623');

		store().linkChat('79235268075', '464953623');

		expect(store().activeChatId).toBe('79235268075');
	});

	it('после связи входящие и список MAX попадают в тот же чат', () => {
		twoChatsForOnePerson();
		store().linkChat('79235268075', '464953623');

		expect(findChatKeyByMaxId(store().chats, '464953623')).toBe('79235268075');
		store().mergeChats([
			{ key: '464953623', chatId: '464953623', maxChatId: '464953623', name: 'Никита' },
		]);
		expect(Object.keys(store().chats)).toEqual(['79235268075']);
	});

	it('дубля нет — просто запоминает id в MAX', () => {
		store().createChat('79235268075');

		store().linkChat('79235268075', '464953623');

		expect(store().chats['79235268075'].maxChatId).toBe('464953623');
	});

	it('уже связан и дубля нет — ничего не меняет', () => {
		store().createChat('79235268075');
		store().linkChat('79235268075', '464953623');
		const before = store();

		store().linkChat('79235268075', '464953623');

		expect(store()).toBe(before);
	});
});

describe('markNoMaxAccount', () => {
	it('помечает чат и не теряет пометку при обновлении чата', () => {
		store().createChat('79235268075');

		store().markNoMaxAccount('79235268075');
		store().addMessage('79235268075', '79235268075@c.us', message());

		expect(store().chats['79235268075'].noMaxAccount).toBe(true);
	});
});

describe('findChatKeyByMaxId', () => {
	it('находит чат по id в MAX — и чат, у которого это id и есть ключ', () => {
		store().mergeChats([
			{ key: '79876543210', chatId: '79876543210@c.us', maxChatId: '10000000' },
			{ key: '20000000', chatId: '20000000', maxChatId: '20000000' },
		]);

		expect(findChatKeyByMaxId(store().chats, '10000000')).toBe('79876543210');
		expect(findChatKeyByMaxId(store().chats, '20000000')).toBe('20000000');
		expect(findChatKeyByMaxId(store().chats, '30000000')).toBeUndefined();
	});
});

describe('updateMessage', () => {
	it('меняет поля сообщения', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'a', status: 'sending' }));

		store().updateMessage('79991234567', 'a', { status: 'failed', error: 'Ошибка' });

		expect(store().messages['79991234567'][0]).toMatchObject({ status: 'failed', error: 'Ошибка' });
	});

	it('для несуществующего сообщения ничего не меняет', () => {
		const before = store();

		store().updateMessage('79991234567', 'нет-такого', { status: 'failed' });

		expect(store()).toBe(before);
	});
});

describe('confirmMessage', () => {
	it('заменяет временный id на idMessage и ставит статус sent', () => {
		store().addMessage(
			'79991234567',
			'79991234567@c.us',
			message({ id: 'local-1', status: 'sending' }),
		);

		store().confirmMessage('79991234567', 'local-1', 'BAE5');

		expect(store().messages['79991234567']).toEqual([
			expect.objectContaining({ id: 'BAE5', status: 'sent' }),
		]);
	});

	it('убирает временное сообщение, если такое idMessage уже есть', () => {
		store().addMessage(
			'79991234567',
			'79991234567@c.us',
			message({ id: 'local-1', status: 'sending' }),
		);
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'BAE5', status: 'sent' }));

		store().confirmMessage('79991234567', 'local-1', 'BAE5');

		expect(store().messages['79991234567'].map((m) => m.id)).toEqual(['BAE5']);
	});

	it('после выхода из аккаунта ничего не делает', () => {
		store().logout();
		const before = store();

		store().confirmMessage('79991234567', 'local-1', 'BAE5');

		expect(store()).toBe(before);
	});
});

describe('removeMessage', () => {
	it('удаляет сообщение из чата', () => {
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'a' }));
		store().addMessage('79991234567', '79991234567@c.us', message({ id: 'b' }));

		store().removeMessage('79991234567', 'a');

		expect(store().messages['79991234567'].map((m) => m.id)).toEqual(['b']);
	});
});

describe('сохранение в localStorage', () => {
	// persist берёт хранилище из window.localStorage, а в Node нет window —
	// без подмены сохранение в тестах молча отключено.
	// Подменяем window на объект с простым хранилищем в памяти (Map).
	const saved = new Map<string, string>();

	beforeEach(() => {
		saved.clear();
		vi.stubGlobal('window', {
			localStorage: {
				getItem: (key: string) => saved.get(key) ?? null,
				setItem: (key: string, value: string) => void saved.set(key, value),
				removeItem: (key: string) => void saved.delete(key),
			},
		});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// Загружает модуль стора заново — как будто страницу перезагрузили.
	// Новый стор при создании читает сохранённое состояние из хранилища
	async function reloadStore() {
		vi.resetModules();
		const imported = await import('./chatStore');
		return imported.useChatStore;
	}

	it('восстанавливает данные входа, чаты, сообщения и открытый чат после перезагрузки', async () => {
		const before = await reloadStore();
		before.getState().login(credentials);
		before.getState().createChat('79991234567');
		before.getState().addMessage('79991234567', '79991234567@c.us', message());

		const after = await reloadStore();

		expect(after.getState().credentials).toEqual(credentials);
		expect(after.getState().chats['79991234567']).toMatchObject({ chatId: '79991234567@c.us' });
		expect(after.getState().messages['79991234567']).toEqual([message()]);
		expect(after.getState().activeChatId).toBe('79991234567');
		// В хранилище лежат только данные, а экшены после восстановления остаются рабочими
		expect(after.getState().createChat('79990000000')).toBe('79990000000');
	});

	it('после logout и перезагрузки пользователь не залогинен и чатов нет', async () => {
		const before = await reloadStore();
		before.getState().login(credentials);
		before.getState().createChat('79991234567');
		before.getState().logout();

		const after = await reloadStore();

		expect(after.getState().credentials).toBeNull();
		expect(after.getState().chats).toEqual({});
	});

	it('после перезагрузки помечает прерванные отправки неотправленными', async () => {
		const before = await reloadStore();
		before
			.getState()
			.addMessage('79991234567', '79991234567@c.us', message({ id: 'local-1', status: 'sending' }));
		before
			.getState()
			.addMessage('79991234567', '79991234567@c.us', message({ id: 'BAE5', status: 'sent' }));

		const after = await reloadStore();

		expect(after.getState().messages['79991234567']).toEqual([
			expect.objectContaining({ id: 'local-1', status: 'failed', error: INTERRUPTED_SEND_ERROR }),
			expect.objectContaining({ id: 'BAE5', status: 'sent' }),
		]);
	});
});
