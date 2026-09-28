// Проверка настроек инстанса: будут ли вообще приходить сообщения.
// По документации после создания инстанса все уведомления выключены — и если их не включить,
// приложение молча получает «очередь пуста», а сообщения от собеседников не приходят.

import type { InstanceSettings } from '@/api/types';
import { asObject, asString } from '@/utils/json';

/**
 * Что не так с настройками:
 * webhookUrl — уведомления уходят на указанный адрес, а не в очередь, которую читает приложение;
 * incomingOff — уведомления о входящих сообщениях выключены: ответы собеседников не придут;
 * outgoingOff — выключены уведомления о сообщениях, отправленных с телефона: они не появятся в чате.
 */
export type SettingsProblem =
	{ kind: 'webhookUrl'; url: string } | { kind: 'incomingOff' } | { kind: 'outgoingOff' };

/**
 * Что записываем кнопкой «Включить»: приём через очередь HTTP API и уведомления
 * о входящих и о сообщениях, отправленных с телефона (чтобы и они сразу появлялись в чате).
 */
export const REQUIRED_SETTINGS: InstanceSettings = {
	webhookUrl: '',
	incomingWebhook: 'yes',
	outgoingMessageWebhook: 'yes',
};

// ---------- «Настройки уже сохранены и применяются» ----------
// По документации setSettings перезапускает инстанс, а настройки вступают в силу в течение 5 минут.
// Если в это время перезагрузить страницу, getSettings может ещё вернуть старые значения —
// и без этой пометки приложение снова предложило бы «Включить приём», а повторное нажатие
// перезапустило бы инстанс ещё раз. Время сохранения храним в localStorage: переживает перезагрузку.

export const SETTINGS_APPLY_MS = 5 * 60_000;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const savedKey = (idInstance: string) => `green-api-settings-saved:${idInstance}`;

export function rememberSettingsSaved(
	storage: KeyValueStorage | null,
	idInstance: string,
	now = Date.now(),
): void {
	try {
		storage?.setItem(savedKey(idInstance), String(now));
	} catch {
		// Хранилище недоступно (например, приватный режим) — просто не запоминаем
	}
}

export function isApplyingSettings(
	storage: KeyValueStorage | null,
	idInstance: string,
	now = Date.now(),
): boolean {
	try {
		const savedAt = Number(storage?.getItem(savedKey(idInstance)));
		return savedAt > 0 && now - savedAt < SETTINGS_APPLY_MS;
	} catch {
		return false;
	}
}

export function forgetSettingsSaved(storage: KeyValueStorage | null, idInstance: string): void {
	try {
		storage?.removeItem(savedKey(idInstance));
	} catch {
		// см. rememberSettingsSaved
	}
}

/**
 * Ищет в ответе getSettings то, из-за чего сообщения не придут. null — всё в порядке
 * или по ответу этого не понять (тогда лучше промолчать, чем зря пугать пользователя).
 */
export function findSettingsProblem(settings: unknown): SettingsProblem | null {
	const data = asObject(settings);
	if (!data) return null;

	const url = asString(data.webhookUrl);
	if (url) return { kind: 'webhookUrl', url };

	// Поле, которого нет в ответе, не считаем выключенным: по такому ответу проблему не понять
	if (data.incomingWebhook !== undefined && data.incomingWebhook !== 'yes') {
		return { kind: 'incomingOff' };
	}
	if (data.outgoingMessageWebhook !== undefined && data.outgoingMessageWebhook !== 'yes') {
		return { kind: 'outgoingOff' };
	}
	return null;
}
