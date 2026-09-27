// Раскладка ленты: перед сообщениями каждого дня — разделитель с датой,
// а подряд идущие сообщения одной стороны складываются в группу:
// внутри группы пузыри стоят вплотную, хвостик — только у последнего.
// Чистая функция без React — поэтому проверяется тестами.

import type { Message } from '@/store/types';
import { formatDay } from '@/utils/format';

// Сообщения с паузой дольше этой — уже разные группы, даже от одной стороны
export const GROUP_GAP_MS = 5 * 60_000;

export type FeedItem =
	| { kind: 'day'; key: string; label: string }
	| { kind: 'message'; message: Message; isLastInGroup: boolean };

// Один ли это день по местному времени пользователя
function sameDay(a: number, b: number): boolean {
	return new Date(a).toDateString() === new Date(b).toDateString();
}

// Продолжает ли next группу message
function continuesGroup(message: Message, next: Message): boolean {
	return (
		next.direction === message.direction &&
		sameDay(message.timestamp, next.timestamp) &&
		next.timestamp - message.timestamp <= GROUP_GAP_MS &&
		// Под неотправленным — строка с ошибкой и кнопками: после неё начинаем новую группу
		message.status !== 'failed'
	);
}

/**
 * Элементы ленты по порядку: разделители дней и сообщения с пометкой «последнее в группе».
 * messages — от старых к новым, как в сторе. now — для подписей «Сегодня» / «Вчера».
 */
export function groupMessages(messages: Message[], now = Date.now()): FeedItem[] {
	const items: FeedItem[] = [];
	messages.forEach((message, i) => {
		const previous = messages[i - 1];
		if (!previous || !sameDay(previous.timestamp, message.timestamp)) {
			items.push({
				kind: 'day',
				// Ключ — по первому сообщению дня, а не по дате: один и тот же день может встретиться
				// в ленте дважды, если сообщения лежат не по порядку (своё — по часам устройства,
				// входящее — по часам сервера), а id сообщений в чате уникальны
				key: `day-${message.id}`,
				label: formatDay(message.timestamp, now),
			});
		}

		const next = messages[i + 1];
		items.push({
			kind: 'message',
			message,
			isLastInGroup: !next || !continuesGroup(message, next),
		});
	});
	return items;
}
