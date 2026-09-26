// Хук: совпадает ли сейчас медиа-запрос, например '(max-width: 700px)'.
// Компонент перерисовывается, когда ответ меняется (повернули телефон, сузили окно).

import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
	// Подписка на изменения. useCallback — чтобы React не переподписывался на каждой перерисовке
	const subscribe = useCallback(
		(onChange: () => void) => {
			const media = window.matchMedia(query);
			media.addEventListener('change', onChange);
			return () => media.removeEventListener('change', onChange);
		},
		[query],
	);

	// useSyncExternalStore читает значение сразу при первой отрисовке —
	// поэтому раскладка не «мигает» с компьютерной на телефонную
	return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
