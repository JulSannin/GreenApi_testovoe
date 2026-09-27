import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Сначала переменные темы из слоя ui, затем глобальные стили приложения, которые их используют
import '@/ui/theme.css';
import './app/global.css';
import App from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		{/* Снаружи App: перехватит ошибку и в самом App, и на любом экране внутри */}
		<ErrorBoundary>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);
