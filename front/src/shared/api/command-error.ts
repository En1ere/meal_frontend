import { ApiError } from './client.js';

export function commandError(error: unknown) {
    if (error instanceof ApiError)
        return error.status === 412
            ? 'Запись изменилась. Ваш ввод сохранён. Обновите данные и проверьте изменения перед повторным сохранением.'
            : error.message;
    return 'Ответ не получен. Проверьте состояние: повтор того же действия использует прежний ключ и не создаст дубль.';
}
