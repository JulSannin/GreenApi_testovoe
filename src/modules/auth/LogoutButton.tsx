// Кнопка «Выйти» с подтверждением.
// Переписка хранится только в этом браузере, и выход стирает её безвозвратно —
// поэтому спрашиваем подтверждение, чтобы случайный клик ничего не удалил.

import { useChatStore } from '@/store/chatStore';
import { Button } from '@/ui';

export function LogoutButton() {
	const logout = useChatStore((state) => state.logout);

	function handleClick() {
		if (window.confirm('Выйти? Чаты и переписка на этом устройстве будут удалены')) {
			// logout очищает стор, и App сам вернёт экран входа
			logout();
		}
	}

	return (
		<Button variant="secondary" size="sm" onClick={handleClick}>
			Выйти
		</Button>
	);
}
