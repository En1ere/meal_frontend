'use client';
import Link from 'next/link';
import { useId, useMemo, useRef, useState } from 'react';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { useSession } from '../../entities/session/client.js';
import type { RecipeDetailData } from './detail.js';
import styles from './recipes.module.css';

const iconNames: Record<string, string> = {
    milk: 'milk',
    gluten: 'gluten',
    egg: 'egg',
    peanut: 'peanut',
    fish: 'fish',
    shellfish: 'shellfish',
    soy: 'soy',
    tree_nuts: 'tree-nuts',
};
const iconSrc = (code: string, icon: RecipeDetailData['allergens'][number]['icon']) => {
    if (icon.url) return icon.url;
    const fallback = icon.fallbackKey.replace(/^allergen-/, '').replace('_', '-');
    return `/assets/allergens/${iconNames[fallback] ?? (fallback === 'tree-nuts' || fallback === 'unknown' ? fallback : (iconNames[code] ?? 'unknown'))}.png`;
};
const statusLabel = { contains: 'Содержит', may_contain: 'Может содержать', unknown: 'Нет данных' } as const;
const productImages = [
    '/assets/products/milk.png',
    '/assets/products/cheese.png',
    '/assets/products/tomato.png',
    '/assets/products/cucumber.png',
];
const ingredientImage = (name: string) => {
    const value = name.toLocaleLowerCase('ru');
    if (value.includes('молок')) return productImages[0]!;
    if (value.includes('сыр') || value.includes('пармез')) return productImages[1]!;
    if (value.includes('томат') || value.includes('помидор')) return productImages[2]!;
    if (value.includes('огур')) return productImages[3]!;
    if (value.includes('рыб') || value.includes('лосос')) return '/assets/allergens/fish.png';
    if (value.includes('арахис')) return '/assets/allergens/peanut.png';
    if (value.includes('орех') || value.includes('миндал')) return '/assets/allergens/tree-nuts.png';
    if (value.includes('паст') || value.includes('овсян')) return '/assets/allergens/gluten.png';
    if (value.includes('соев') || value.includes('тофу')) return '/assets/allergens/soy.png';
    return '/assets/allergens/unknown.png';
};

export function RecipeAllergens({ recipe }: { recipe: RecipeDetailData }) {
    const { api } = useRuntime();
    const session = useSession('user');
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const reportAttempt = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [selected, setSelected] = useState(
        () => new Set(recipe.allergenCompleteness.unknownIngredients.map((x) => x.recipeIngredientId)),
    );
    const [note, setNote] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [ticket, setTicket] = useState<{ ticketId: string; ticketNumber: string } | null>(null);
    const grouped = useMemo(
        () => ({
            contains: recipe.allergens.filter((x) => x.status === 'contains'),
            may_contain: recipe.allergens.filter((x) => x.status === 'may_contain'),
            unknown: recipe.allergens.filter((x) => x.status === 'unknown'),
        }),
        [recipe.allergens],
    );
    const incomplete = !recipe.allergenCompleteness.complete;

    function open() {
        setReportOpen(false);
        setTicket(null);
        setError('');
        dialog.current?.showModal();
    }

    async function report() {
        if (!api || pending || selected.size === 0) return;
        const payload = { unknownIngredientIds: [...selected].sort(), note };
        const fingerprint = JSON.stringify(payload);
        if (reportAttempt.current?.fingerprint !== fingerprint)
            reportAttempt.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
        setPending(true);
        setError('');
        try {
            const result = await api.request('POST /api/v1/allergens/reports', {
                recipeId: recipe.id,
                revisionId: recipe.revisionId,
                unknownIngredientIds: payload.unknownIngredientIds,
                note,
                idempotencyKey: reportAttempt.current.idempotencyKey,
            });
            reportAttempt.current = null;
            setTicket(result.data);
        } catch (cause) {
            setError(cause instanceof ApiError ? cause.message : 'Не удалось отправить обращение. Попробуйте ещё раз.');
        } finally {
            setPending(false);
        }
    }

    return (
        <section className={`${styles.panel} ${styles['allergen-summary']}`}>
            <div className={styles['allergen-heading']}>
                <div>
                    <h2>Аллергены</h2>
                    <p className={styles.muted}>Проверьте состав перед приготовлением.</p>
                </div>
                <button className="button outline" onClick={open}>
                    Подробнее
                </button>
            </div>
            <div className={styles['allergen-strip']}>
                {recipe.allergens.map((allergen) => (
                    <button
                        type="button"
                        className={styles['allergen-chip']}
                        key={`${allergen.code}:${allergen.status}`}
                        aria-label={`${allergen.name}: ${statusLabel[allergen.status]}. Открыть сведения`}
                        onClick={open}
                    >
                        <img src={iconSrc(allergen.code, allergen.icon)} alt="" />
                        <span>
                            <strong>{allergen.name}</strong>
                            <small>{statusLabel[allergen.status]}</small>
                        </span>
                    </button>
                ))}
                {incomplete && (
                    <button
                        type="button"
                        className={`${styles['allergen-chip']} ${styles['allergen-incomplete']}`}
                        aria-label="Данные об аллергенах не указаны. Открыть сведения"
                        onClick={open}
                    >
                        <img src="/assets/allergens/unknown.png" alt="" />
                        <span>
                            <strong>Данные об аллергенах не указаны</strong>
                            <small>Для части состава</small>
                        </span>
                    </button>
                )}
            </div>
            <p className={styles['pending-note']}>Отсутствие данных не означает, что продукт безопасен при аллергии.</p>

            <dialog
                ref={dialog}
                className={`${styles.dialog} ${styles['allergen-dialog']}`}
                aria-labelledby={titleId}
                onClose={() => setReportOpen(false)}
            >
                <div className={styles['dialog-heading']}>
                    <div>
                        <p className={styles.eyebrow}>Безопасность</p>
                        <h2 id={titleId}>Сведения об аллергенах</h2>
                    </div>
                    <button className="button outline" aria-label="Закрыть" onClick={() => dialog.current?.close()}>
                        Закрыть
                    </button>
                </div>
                <p className={styles.muted}>{recipe.title}</p>
                {(['contains', 'may_contain', 'unknown'] as const).map((status) =>
                    grouped[status].length ? (
                        <section className={styles['allergen-group']} key={status}>
                            <h3>{statusLabel[status]}</h3>
                            {grouped[status].map((allergen) => (
                                <article className={styles['allergen-row']} key={`${status}:${allergen.code}`}>
                                    <img src={iconSrc(allergen.code, allergen.icon)} alt={allergen.icon.alt} />
                                    <div>
                                        <strong>{allergen.name}</strong>
                                        {allergen.ingredients.length ? (
                                            <ul className={styles['linked-ingredients']}>
                                                {allergen.ingredients.map((item) => (
                                                    <li key={item.recipeIngredientId}>
                                                        <img src={ingredientImage(item.name)} alt="" />
                                                        {item.name}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>{allergen.source}</p>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </section>
                    ) : null,
                )}
                {incomplete && (
                    <section className={`${styles['allergen-group']} ${styles['unknown-group']}`}>
                        <h3>Нет данных</h3>
                        <p>
                            <strong>Данные об аллергенах не указаны</strong>
                        </p>
                        <p className={styles.muted}>Не удалось подтвердить сведения для следующих ингредиентов:</p>
                        <ul className={styles['unknown-list']}>
                            {recipe.allergenCompleteness.unknownIngredients.map((item) => (
                                <li key={item.recipeIngredientId}>
                                    <img src={ingredientImage(item.name)} alt="" />
                                    {item.name}
                                </li>
                            ))}
                        </ul>
                        {!reportOpen &&
                            !ticket &&
                            (session.data ? (
                                <button className="button outline" onClick={() => setReportOpen(true)}>
                                    Сообщить об отсутствии данных
                                </button>
                            ) : (
                                <Link
                                    className="button outline"
                                    href={`/auth?returnTo=${encodeURIComponent(`/recipes/${recipe.id}`)}`}
                                >
                                    Войти и сообщить
                                </Link>
                            ))}
                    </section>
                )}
                {reportOpen && !ticket && (
                    <section className={styles['allergen-report']} aria-labelledby="allergen-report-title">
                        <h3 id="allergen-report-title">Обращение в поддержку</h3>
                        <p className={styles.muted}>
                            Рецепт и редакция будут приложены автоматически. Личные настройки и предпочтения не
                            отправляются.
                        </p>
                        <dl>
                            <div>
                                <dt>Рецепт</dt>
                                <dd>{recipe.title}</dd>
                            </div>
                            <div>
                                <dt>Редакция</dt>
                                <dd>{recipe.revisionId}</dd>
                            </div>
                        </dl>
                        <fieldset>
                            <legend>Ингредиенты без данных</legend>
                            {recipe.allergenCompleteness.unknownIngredients.map((item) => (
                                <label key={item.recipeIngredientId}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(item.recipeIngredientId)}
                                        onChange={(event) =>
                                            setSelected((current) => {
                                                const next = new Set(current);
                                                if (event.target.checked) next.add(item.recipeIngredientId);
                                                else next.delete(item.recipeIngredientId);
                                                return next;
                                            })
                                        }
                                    />{' '}
                                    {item.name}
                                </label>
                            ))}
                        </fieldset>
                        <label>
                            Комментарий (необязательно)
                            <textarea maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
                        </label>
                        {error && (
                            <p className={styles.error} role="alert">
                                {error}
                            </p>
                        )}
                        <button
                            className="button"
                            disabled={pending || selected.size === 0}
                            onClick={() => void report()}
                        >
                            {pending ? <ArcInlineLoader label="Отправляем" /> : 'Отправить в поддержку'}
                        </button>
                    </section>
                )}
                {ticket && (
                    <div className={styles['report-success']} role="status">
                        <strong>Обращение {ticket.ticketNumber} создано.</strong>
                        <Link href={`/support/${ticket.ticketId}`}>Открыть обращение</Link>
                    </div>
                )}
            </dialog>
        </section>
    );
}
