// Публичный интерфейс слоя components: составные элементы, которые знают о чате
// (типы Chat, Message), но не знают о сторе и API — всё получают через props.

export { ChatHeader } from './ChatHeader/ChatHeader';
export { ChatListItem } from './ChatListItem/ChatListItem';
export { MessageBubble } from './MessageBubble/MessageBubble';
