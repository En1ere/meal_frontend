import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CriticalConfirmation } from '../auth/critical-confirmation.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { newsContentSchema, type NewsCommand, type NewsContent, type NewsItem, type NewsResult } from './contracts.js';
import styles from './news-workspace.module.css';

export type NewsApi = (command: NewsCommand, signal?: AbortSignal) => Promise<NewsResult>;
const emptyAudience: NewsContent['audience'] = {
    plans: [],
    genders: [],
    families: [],
    registeredFrom: null,
    registeredTo: null,
    activeFrom: null,
    activeTo: null,
};
const emptyContent = (): NewsContent => ({
    type: 'article',
    title: '',
    pages: [{ blocks: [{ kind: 'text', text: '' }] }],
    sources: [],
    audience: { ...emptyAudience },
    channels: ['in_app'],
    category: 'service',
});
const statuses = {
    draft: 'Черновик',
    published: 'Опубликовано',
    scheduled: 'Запланировано',
    cancelled: 'Отправка отменена',
};

export function NewsWorkspace({ api }: { api: NewsApi }) {
    const cache = useQueryClient();
    const query = useQuery({
        queryKey: ['admin-news-workspace'],
        queryFn: ({ signal }) => api({ action: 'list' }, signal),
    });
    const [selected, setSelected] = useState<NewsItem | null>(null);
    const [content, setContent] = useState<NewsContent>(emptyContent);
    const [id, setId] = useState<string>(() => crypto.randomUUID());
    const [dirty, setDirty] = useState(true);
    const [mobile, setMobile] = useState(true);
    const [page, setPage] = useState(0);
    const [scheduled, setScheduled] = useState('');
    const [recipients, setRecipients] = useState<('admin' | 'moderator')[]>(['admin']);
    const [preview, setPreview] = useState<NewsResult['preview']>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [pending, setPending] = useState(false);
    const lock = useRef(false);
    const beginRequest = useRequestSignal();
    const retry = useRef<{ digest: string; key: string } | null>(null);
    function edit(value: NewsContent) {
        setContent(value);
        setDirty(true);
        setPreview(null);
        setError('');
    }
    function choose(item: NewsItem | null) {
        setSelected(item);
        setId(item?.id ?? crypto.randomUUID());
        setContent(item?.content ?? emptyContent());
        setDirty(!item);
        setPreview(null);
        setPage(0);
        setError('');
        setMessage('');
        retry.current = null;
    }
    async function run(command: NewsCommand) {
        if (lock.current) return;
        lock.current = true;
        setPending(true);
        setError('');
        setMessage('');
        if ('idempotencyKey' in command) {
            const digest = JSON.stringify({ ...command, idempotencyKey: '' });
            if (retry.current?.digest !== digest) retry.current = { digest, key: command.idempotencyKey };
            command = { ...command, idempotencyKey: retry.current.key };
        }
        const signal = beginRequest();
        try {
            const result = await api(command, signal);
            signal.throwIfAborted();
            cache.setQueryData(['admin-news-workspace'], result);
            const item = result.items.find((value) => value.id === id);
            if (item) {
                setSelected(item);
                setContent(item.content);
                setDirty(false);
            }
            setPreview(result.preview);
            setMessage(result.message);
            retry.current = null;
        } catch (failure) {
            if (signal.aborted) return;
            setError(failure instanceof Error ? failure.message : 'Не удалось выполнить команду. Повторите её.');
        } finally {
            lock.current = false;
            setPending(false);
        }
    }
    function save() {
        const parsed = newsContentSchema.safeParse(content);
        if (!parsed.success) {
            setError(parsed.error.issues.map((issue) => issue.message).join(' '));
            return;
        }
        void run({
            action: 'save',
            id,
            version: selected?.version ?? 0,
            content: parsed.data,
            idempotencyKey: crypto.randomUUID(),
        });
    }
    function updateBlocks(blocks: NewsContent['pages'][number]['blocks']) {
        edit({ ...content, pages: content.pages.map((value, index) => (index === page ? { blocks } : value)) });
    }
    const blocks = content.pages[page]!.blocks;
    const target = { id, version: selected?.version ?? 1 };
    const externalDeliveryUnavailable = content.channels.some((channel) => channel !== 'in_app');
    return (
        <section className={styles.workspace} aria-busy={pending}>
            <header>
                <h2>Новости и рассылки</h2>
                <p>Создайте материал, проверьте его вид в приложении и выберите аудиторию.</p>
            </header>
            {query.isPending && <p role="status">Загрузка новостей…</p>}
            {query.isError && (
                <p role="alert">
                    Не удалось загрузить новости.{' '}
                    <button className="button outline" onClick={() => void query.refetch()}>
                        Повторить
                    </button>
                </p>
            )}
            <div className={`${styles.list} ${styles['news-picker']}`}>
                <button className="button outline" disabled={pending} onClick={() => choose(null)}>
                    Новая новость
                </button>
                {query.data?.items.map((item) => (
                    <button
                        className="button outline"
                        key={item.id}
                        disabled={pending}
                        aria-pressed={selected?.id === item.id}
                        onClick={() => choose(item)}
                    >
                        {item.content.title} · {statuses[item.status]}
                    </button>
                ))}
            </div>
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            <fieldset disabled={pending} className={styles.editor}>
                <legend>Содержание · версия {selected?.version ?? 'новая'}</legend>
                <label>
                    Тип публикации
                    <select
                        value={content.type ?? 'article'}
                        onChange={(event) =>
                            edit({ ...content, type: event.target.value === 'important' ? 'important' : 'article' })
                        }
                    >
                        <option value="article">Обычная новость</option>
                        <option value="important">Важное объявление</option>
                    </select>
                </label>
                <label>
                    Заголовок
                    <input
                        maxLength={200}
                        value={content.title}
                        onChange={(e) => edit({ ...content, title: e.target.value })}
                    />
                </label>
                <div className={styles.list}>
                    {content.pages.map((_, index) => (
                        <button
                            className="button outline"
                            key={index}
                            aria-pressed={page === index}
                            onClick={() => setPage(index)}
                        >
                            Страница {index + 1}
                        </button>
                    ))}
                    <button
                        className="button outline"
                        disabled={content.pages.length >= 10}
                        onClick={() => {
                            edit({ ...content, pages: [...content.pages, { blocks: [{ kind: 'text', text: '' }] }] });
                            setPage(content.pages.length);
                        }}
                    >
                        Добавить страницу
                    </button>
                    {content.pages.length > 1 && (
                        <button
                            className="button outline"
                            onClick={() => {
                                edit({ ...content, pages: content.pages.filter((_, index) => index !== page) });
                                setPage(0);
                            }}
                        >
                            Удалить страницу
                        </button>
                    )}
                </div>
                {blocks.map((block, index) => (
                    <div key={index} className={styles.block}>
                        <strong>
                            {block.kind === 'text' ? 'Текст' : block.kind === 'image' ? 'Изображение' : 'Ссылка'}
                        </strong>
                        {block.kind === 'text' ? (
                            <label>
                                Текст блока
                                <textarea
                                    value={block.text}
                                    onChange={(e) =>
                                        updateBlocks(
                                            blocks.map((value, i) =>
                                                i === index ? { ...block, text: e.target.value } : value,
                                            ),
                                        )
                                    }
                                />
                            </label>
                        ) : (
                            <>
                                <label>
                                    HTTPS-ссылка
                                    <input
                                        type="url"
                                        value={block.url}
                                        onChange={(e) =>
                                            updateBlocks(
                                                blocks.map((value, i) =>
                                                    i === index ? { ...block, url: e.target.value } : value,
                                                ),
                                            )
                                        }
                                    />
                                </label>
                                <label>
                                    {block.kind === 'image' ? 'Описание изображения' : 'Текст ссылки'}
                                    <input
                                        value={block.kind === 'image' ? block.alt : block.text}
                                        onChange={(e) =>
                                            updateBlocks(
                                                blocks.map((value, i) =>
                                                    i !== index
                                                        ? value
                                                        : block.kind === 'image'
                                                          ? { ...block, alt: e.target.value }
                                                          : { ...block, text: e.target.value },
                                                ),
                                            )
                                        }
                                    />
                                </label>
                            </>
                        )}
                        <button
                            className="button outline"
                            disabled={blocks.length === 1}
                            onClick={() => updateBlocks(blocks.filter((_, i) => i !== index))}
                        >
                            Удалить блок
                        </button>
                    </div>
                ))}
                <div className={styles.list}>
                    {(['text', 'image', 'link'] as const).map((kind) => (
                        <button
                            className="button outline"
                            key={kind}
                            disabled={blocks.length >= 30}
                            onClick={() =>
                                updateBlocks([
                                    ...blocks,
                                    kind === 'text'
                                        ? { kind, text: '' }
                                        : kind === 'image'
                                          ? { kind, url: '', alt: '' }
                                          : { kind, url: '', text: '' },
                                ])
                            }
                        >
                            Добавить {kind === 'text' ? 'текст' : kind === 'image' ? 'изображение' : 'ссылку'}
                        </button>
                    ))}
                </div>
                <p>
                    Загрузка файлов будет доступна после подключения хранилища и проверки медиа. Сейчас можно указать
                    HTTPS-ссылку.
                </p>
                <h2>Источники фактических утверждений</h2>
                {content.sources.map((source, index) => (
                    <div className={styles.block} key={index}>
                        <label>
                            Утверждение
                            <input
                                value={source.claim}
                                onChange={(e) =>
                                    edit({
                                        ...content,
                                        sources: content.sources.map((s, i) =>
                                            i === index ? { ...s, claim: e.target.value } : s,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <label>
                            Источник
                            <textarea
                                value={source.source}
                                onChange={(e) =>
                                    edit({
                                        ...content,
                                        sources: content.sources.map((s, i) =>
                                            i === index ? { ...s, source: e.target.value } : s,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <button
                            className="button outline"
                            onClick={() => edit({ ...content, sources: content.sources.filter((_, i) => i !== index) })}
                        >
                            Удалить источник
                        </button>
                    </div>
                ))}
                <button
                    className="button outline"
                    onClick={() => edit({ ...content, sources: [...content.sources, { claim: '', source: '' }] })}
                >
                    Добавить источник
                </button>
                <h2>Аудитория</h2>
                <p>Внутри фильтра — ИЛИ, между фильтрами — И. Pro включает семейный доступ.</p>
                <button className="button outline" onClick={() => edit({ ...content, audience: { ...emptyAudience } })}>
                    Все пользователи: сбросить фильтры
                </button>
                {(['plans', 'genders', 'families'] as const).map((filter) => (
                    <label key={filter}>
                        {filter === 'plans' ? 'Тариф' : filter === 'genders' ? 'Пол' : 'Наличие семьи'}
                        <select
                            multiple
                            value={content.audience[filter]}
                            onChange={(e) =>
                                edit({
                                    ...content,
                                    audience: {
                                        ...content.audience,
                                        [filter]: Array.from(e.target.selectedOptions, (option) => option.value),
                                    },
                                })
                            }
                        >
                            {(filter === 'plans'
                                ? [
                                      ['free', 'Бесплатный'],
                                      ['plus', 'Plus'],
                                      ['pro', 'Pro'],
                                  ]
                                : filter === 'genders'
                                  ? [
                                        ['female', 'Женский'],
                                        ['male', 'Мужской'],
                                        ['unknown', 'Не указан'],
                                    ]
                                  : [
                                        ['yes', 'Есть семья'],
                                        ['no', 'Без семьи'],
                                    ]
                            ).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
                {(['registeredFrom', 'registeredTo', 'activeFrom', 'activeTo'] as const).map((field) => (
                    <label key={field}>
                        {
                            {
                                registeredFrom: 'Регистрация с',
                                registeredTo: 'Регистрация до',
                                activeFrom: 'Активность с',
                                activeTo: 'Активность до',
                            }[field]
                        }
                        <input
                            type="date"
                            value={
                                content.audience[field]
                                    ? new Date(
                                          Date.parse(content.audience[field]) -
                                              new Date(content.audience[field]).getTimezoneOffset() * 60000,
                                      )
                                          .toISOString()
                                          .slice(0, 10)
                                    : ''
                            }
                            onChange={(e) =>
                                edit({
                                    ...content,
                                    audience: {
                                        ...content.audience,
                                        [field]: e.target.value
                                            ? new Date(
                                                  `${e.target.value}T${field.endsWith('To') ? '23:59:59.999' : '00:00:00.000'}`,
                                              ).toISOString()
                                            : null,
                                    },
                                })
                            }
                        />
                    </label>
                ))}
                <p>Даты показаны в вашем локальном времени. Неизвестная дата не соответствует заданному диапазону.</p>
                <label>
                    Тип сообщения
                    <select
                        value={content.category}
                        onChange={(e) => edit({ ...content, category: e.target.value as NewsContent['category'] })}
                    >
                        <option value="service">Сервисное</option>
                        <option value="marketing">Маркетинговое</option>
                    </select>
                </label>
                {(['in_app', 'email', 'push'] as const).map((channel) => (
                    <label key={channel}>
                        <input
                            type="checkbox"
                            checked={content.channels.includes(channel)}
                            onChange={(e) =>
                                edit({
                                    ...content,
                                    channels: e.target.checked
                                        ? [...content.channels, channel]
                                        : content.channels.filter((c) => c !== channel),
                                })
                            }
                        />
                        {{ in_app: 'В приложении', email: 'Email', push: 'Push' }[channel]}
                    </label>
                ))}
                <button className="button primary" onClick={save}>
                    Сохранить {selected?.status === 'published' ? 'новую версию без рассылки' : 'черновик'}
                </button>
            </fieldset>
            <section className={styles.preview}>
                <h2>Предпросмотр в приложении</h2>
                <div className={styles.list}>
                    <button className="button outline" aria-pressed={mobile} onClick={() => setMobile(true)}>
                        Мобильный
                    </button>
                    <button className="button outline" aria-pressed={!mobile} onClick={() => setMobile(false)}>
                        Десктоп
                    </button>
                </div>
                <article className={mobile ? styles.mobile : styles.desktop}>
                    <h2>{content.title || 'Заголовок новости'}</h2>
                    {blocks.map((block, index) =>
                        block.kind === 'text' ? (
                            <p key={index}>{block.text || 'Текст блока'}</p>
                        ) : block.kind === 'image' ? (
                            <div key={index} className={styles.image}>
                                Изображение: {block.alt || 'Добавьте описание'}
                                <small>Предпросмотр медиа появится после проверки файла.</small>
                            </div>
                        ) : (
                            <span key={index} className={styles.link}>
                                {block.text || 'Текст ссылки'}
                            </span>
                        ),
                    )}
                    <small>
                        Страница {page + 1} из {content.pages.length}
                    </small>
                </article>
            </section>
            <section className={styles.editor}>
                <h2>Публикация и отправка</h2>
                <p>
                    Число получателей предварительное. Для расписания аудитория и согласия проверяются заново при
                    запуске.
                </p>
                <button
                    className="button outline"
                    disabled={pending || dirty}
                    onClick={() => void run({ action: 'preview', ...target })}
                >
                    Рассчитать аудиторию сохранённой версии
                </button>
                {preview && (
                    <p role="status">
                        Версия {preview.version}: {preview.recipients} получателей
                        {preview.mock ? ' · тестовые данные' : ''}. Каналы: {content.channels.join(', ')}.
                    </p>
                )}
                {externalDeliveryUnavailable && (
                    <p role="note">
                        Email и push можно сохранить в черновике, но отправка выключена до подключения провайдеров. Для
                        публикации сейчас оставьте только канал «В приложении».
                    </p>
                )}
                <CriticalConfirmation />
                <label>
                    Расписание (ваше локальное время; пусто — сейчас)
                    <input
                        type="datetime-local"
                        value={scheduled}
                        onChange={(e) => setScheduled(e.target.value)}
                        disabled={pending}
                    />
                </label>
                <button
                    className="button primary"
                    disabled={
                        pending || dirty || !preview || selected?.status === 'scheduled' || externalDeliveryUnavailable
                    }
                    onClick={() =>
                        void run({
                            action: 'launch',
                            ...target,
                            scheduledAt: scheduled ? new Date(scheduled).toISOString() : null,
                            idempotencyKey: crypto.randomUUID(),
                        })
                    }
                >
                    {scheduled ? 'Подтвердить запланированную рассылку' : 'Подтвердить публикацию и рассылку'}
                </button>
                {selected?.status === 'scheduled' && (
                    <button
                        className="button outline"
                        disabled={pending}
                        onClick={() => void run({ action: 'cancel', ...target, idempotencyKey: crypto.randomUUID() })}
                    >
                        Отменить ещё не начатую отправку
                    </button>
                )}
                <h3>Тестовые получатели</h3>
                {(['admin', 'moderator'] as const).map((role) => (
                    <label key={role}>
                        <input
                            type="checkbox"
                            checked={recipients.includes(role)}
                            onChange={(e) =>
                                setRecipients(
                                    e.target.checked ? [...recipients, role] : recipients.filter((r) => r !== role),
                                )
                            }
                        />
                        {role === 'admin' ? 'Администратор' : 'Модераторы'}
                    </label>
                ))}
                <button
                    className="button outline"
                    disabled={pending || dirty || !recipients.length || externalDeliveryUnavailable}
                    onClick={() =>
                        void run({ action: 'test', ...target, recipients, idempotencyKey: crypto.randomUUID() })
                    }
                >
                    Тестовая отправка
                </button>
                {selected && (
                    <details>
                        <summary>История: {selected.history.length} предыдущих версий</summary>
                        {selected.history.map((entry) => (
                            <div key={entry.version}>
                                <h3>
                                    Версия {entry.version}: {entry.content.title}
                                </h3>
                                <p>{new Date(entry.at).toLocaleString('ru-RU')}</p>
                                {entry.content.pages
                                    .flatMap((p) => p.blocks)
                                    .map((block, index) => (
                                        <p key={index}>{block.kind === 'image' ? block.alt : block.text}</p>
                                    ))}
                            </div>
                        ))}
                    </details>
                )}
            </section>
        </section>
    );
}
