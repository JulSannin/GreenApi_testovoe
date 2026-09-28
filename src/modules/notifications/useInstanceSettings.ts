// Хук: при открытии экрана чата проверяет настройки инстанса и умеет их исправить.

import { useEffect, useState } from 'react';
import { describeServerStatus } from '@/api/errorMessages';
import { ApiError, getSettings, setSettings } from '@/api/greenApi';
import { withTimeout } from '@/api/withTimeout';
import { useChatStore } from '@/store/chatStore';
import {
	findSettingsProblem,
	forgetSettingsSaved,
	isApplyingSettings,
	rememberSettingsSaved,
	REQUIRED_SETTINGS,
	type SettingsProblem,
} from './instanceSettings';

const REQUEST_TIMEOUT_MS = 15_000;

// localStorage, если он доступен. В приватном режиме обращение к нему может бросить ошибку
function browserStorage(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

/**
 * ok — проблем нет (или проверить не удалось);
 * problem — сообщения не придут, пока настройки не исправят;
 * saved — настройки сохранены, по документации вступят в силу в течение 5 минут.
 */
export type SettingsState =
	| { kind: 'ok' }
	| { kind: 'problem'; problem: SettingsProblem; saving: boolean; error?: string }
	| { kind: 'saved' };

export function useInstanceSettings() {
	const credentials = useChatStore((state) => state.credentials);
	const [state, setState] = useState<SettingsState>({ kind: 'ok' });

	useEffect(() => {
		if (!credentials) return;
		const controller = new AbortController();

		withTimeout(controller.signal, REQUEST_TIMEOUT_MS, (signal) => getSettings(credentials, signal))
			.then((settings) => {
				const storage = browserStorage();
				const problem = findSettingsProblem(settings);
				if (!problem) {
					// Настройки в порядке — пометка «применяются» больше не нужна
					forgetSettingsSaved(storage, credentials.idInstance);
					return;
				}
				// Настройки недавно сохранили и они ещё применяются — не предлагаем исправить снова
				setState(
					isApplyingSettings(storage, credentials.idInstance)
						? { kind: 'saved' }
						: { kind: 'problem', problem, saving: false },
				);
			})
			.catch(() => {
				// Проверка настроек — подсказка, а не условие работы: если не удалась, молчим.
				// Сами проблемы со связью покажет плашка цикла приёма
			});

		return () => controller.abort();
	}, [credentials]);

	async function fix() {
		if (!credentials || state.kind !== 'problem') return;

		// Если уведомления уходят на чужой адрес, им может пользоваться другая программа —
		// прежде чем отключать, спрашиваем
		if (
			state.problem.kind === 'webhookUrl' &&
			!window.confirm(
				`Уведомления перестанут уходить на ${state.problem.url}. Если этот адрес использует другая программа, она перестанет получать сообщения. Продолжить?`,
			)
		) {
			return;
		}

		setState({ ...state, saving: true, error: undefined });
		// Почему не получилось — для текста ошибки
		let reason: string;
		try {
			const result = await setSettings(
				credentials,
				REQUIRED_SETTINGS,
				AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			);
			if (result.saveSettings) {
				rememberSettingsSaved(browserStorage(), credentials.idInstance);
				setState({ kind: 'saved' });
				return;
			}
			// Сервер ответил, но настройки не сохранил — связь тут ни при чём
			reason = 'сервер не принял настройки';
		} catch (error) {
			reason =
				error instanceof ApiError
					? (describeServerStatus(error.status) ?? `код ${error.status}`)
					: 'нет связи с сервером';
		}
		setState({
			...state,
			saving: false,
			error: `Не удалось сохранить настройки (${reason}). Попробуйте ещё раз или измените их в личном кабинете GREEN-API`,
		});
	}

	// Скрыть плашку «настройки сохранены»
	function dismiss() {
		setState({ kind: 'ok' });
	}

	return { state, fix, dismiss };
}
