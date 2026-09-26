import { ChatScreen } from './components/ChatScreen/ChatScreen';
import { LoginForm } from './components/LoginForm/LoginForm';
import { useChatStore } from './store/chatStore';

// Роутинг не нужен: есть данные входа — показываем чат, нет — форму входа
function App() {
	const isLoggedIn = useChatStore((state) => state.credentials !== null);

	return isLoggedIn ? <ChatScreen /> : <LoginForm />;
}

export default App;
