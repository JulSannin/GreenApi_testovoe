import { ChatPage } from '@/pages/ChatPage/ChatPage';
import { LoginPage } from '@/pages/LoginPage/LoginPage';
import { useChatStore } from '@/store/chatStore';

// Роутинг не нужен: есть данные входа — показываем чат, нет — страницу входа
function App() {
	const isLoggedIn = useChatStore((state) => state.credentials !== null);

	return isLoggedIn ? <ChatPage /> : <LoginPage />;
}

export default App;
