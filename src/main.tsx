import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Сначала переменные темы из слоя ui, затем глобальные стили приложения, которые их используют
import '@/ui/theme.css';
import './app/global.css';
import App from './app/App';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
