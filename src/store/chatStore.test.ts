// Тесты логики стора. React здесь не нужен: экшены вызываются напрямую через getState(),
// а результат читается оттуда же.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Credentials } from '../api/types';
import { INTERRUPTED_SEND_ERROR, useChatStore } from './chatStore';
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
