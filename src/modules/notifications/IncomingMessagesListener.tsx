// Приём входящих сообщений и проверка настроек инстанса. Сам ничего не рисует,
// пока всё работает; при проблемах показывает плашку сверху экрана — одну, самую важную.
// Действие для «сессия недействительна» (кнопку «Выйти» из модуля auth) передаёт страница:
// модули не импортируют друг друга.

import type { ReactNode } from 'react';
import { Banner, Button } from '@/ui';
import type { SettingsProblem } from './instanceSettings';
import { useIncomingMessages } from './useIncomingMessages';
import { useInstanceSettings } from './useInstanceSettings';

// Текст плашки для проблемы с настройками. Если добавить новую проблему и забыть её здесь,
// TypeScript не соберёт проект: функция без return для неё не вернёт строку
function settingsProblemText(problem: SettingsProblem): string {
	switch (problem.kind) {
		case 'webhookUrl':
			return `В настройках инстанса указан адрес для уведомлений (${problem.url}) — сообщения уходят туда, а не в это приложение.`;
		case 'incomingOff':
			return 'В настройках инстанса выключены уведомления о входящих сообщениях — сообщения от собеседников не придут.';
		case 'outgoingOff':
			return 'В настройках инстанса выключены уведомления об исходящих сообщениях — то, что вы отправите с телефона, здесь не появится.';
	}
}

type Props = {
	unauthorizedAction?: ReactNode;
};

export function IncomingMessagesListener({ unauthorizedAction }: Props) {
	const status = useIncomingMessages();
	const settings = useInstanceSettings();

	// 1. Токен не подходит — без нового входа не работает ничего
	if (status.kind === 'unauthorized') {
		return (
			<Banner tone="error" action={unauthorizedAction}>
				Сессия недействительна: токен инстанса больше не подходит. Войдите заново
			</Banner>
		);
	}

	// 2. Настройки инстанса: сообщения не придут, пока их не исправить
	if (settings.state.kind === 'problem') {
		const { problem, saving, error } = settings.state;
		const text = settingsProblemText(problem);

		return (
			<Banner
				tone="warning"
				action={
					<Button size="xs" onClick={() => void settings.fix()} disabled={saving}>
						{saving ? 'Сохраняем…' : 'Включить приём'}
					</Button>
				}
			>
				{text}
				{error && ` ${error}`}
			</Banner>
		);
	}

	if (settings.state.kind === 'saved') {
		return (
			<Banner
				tone="info"
				action={
					<Button size="xs" variant="secondary" onClick={settings.dismiss}>
						Понятно
					</Button>
				}
			>
				Настройки сохранены. Инстанс перезапускается — новые сообщения начнут приходить в течение 5
				минут
			</Banner>
		);
	}

	// 3. Временные проблемы со связью
	if (status.kind === 'retrying') {
		return <Banner tone="warning">{status.message}</Banner>;
	}

	return null;
}
