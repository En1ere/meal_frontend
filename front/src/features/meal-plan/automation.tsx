'use client';

import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import type { Success } from '../../shared/api/contracts.generated.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../auth/session.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import styles from './plan.module.css';

type Selection = {
    scope: 'private' | 'family';
    view: 'range';
    date: string;
    endDate: string;
    timezone: string;
};
type Preview = Success<'POST /api/v1/meal-plan/automation-preview'>['data'];
type Family = Success<'GET /api/v1/family'>['data'];
type Member = NonNullable<Family['family']>['members'][number];
const weekdays = [
    [1, 'Пн'],
    [2, 'Вт'],
    [3, 'Ср'],
    [4, 'Чт'],
    [5, 'Пт'],
    [6, 'Сб'],
    [0, 'Вс'],
] as const;

export function PlanAutomation({
    selection,
    version,
    members,
    pro,
    onCommitted,
}: {
    selection: Selection;
    version: number;
    members: Member[];
    pro: boolean;
    onCommitted: () => Promise<void>;
}) {
    const { api } = useRuntime();
    const user = useSession('user');
    const [recipeId, setRecipeId] = useState('');
    const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('dinner');
    const [days, setDays] = useState<number[]>([6]);
    const [portions, setPortions] = useState(2);
    const [optimize, setOptimize] = useState(false);
    const [alternativeIds, setAlternativeIds] = useState<string[]>([]);
    const [priorityPreset, setPriorityPreset] = useState<'expiry' | 'nutrition' | 'budget'>('expiry');
    const [maxBudgetRub, setMaxBudgetRub] = useState(1000);
    const [assignments, setAssignments] = useState<Record<string, number>>({});
    const [preview, setPreview] = useState<Preview | null>(null);
    const [frozenRule, setFrozenRule] = useState<{
        recipeId: string;
        revisionId: string;
        meal: typeof meal;
        weekdays: number[];
        portions: number;
        assignments?: Array<{ userId: string; portions: number }>;
        alternatives?: Array<{ recipeId: string; revisionId: string }>;
        optimization?: {
            priorities: Array<'expiry' | 'nutrition' | 'budget'>;
            maxBudgetMinor: number;
            targetMealSharePercent: number;
        };
        conflictPolicy: 'skip-existing';
    } | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const recipes = useQuery({
        queryKey: ['meal-plan', 'automation-recipes', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) =>
            (
                await api!.request('GET /api/v1/recipes', undefined, signal, undefined, {
                    query: { q: '', tab: 'new', page: '1', limit: '100' },
                })
            ).data.items,
    });
    async function submit(event: FormEvent) {
        event.preventDefault();
        const recipe = recipes.data?.find((candidate) => candidate.id === recipeId);
        if (!api || !recipe || !days.length) return;
        const rule = {
            recipeId: recipe.id,
            revisionId: recipe.revisionId,
            meal,
            weekdays: [...days].sort((left, right) => left - right),
            portions,
            ...(selection.scope === 'family'
                ? {
                      assignments: members
                          .map((member) => ({ userId: member.userId, portions: assignments[member.userId] ?? 0 }))
                          .filter((assignment) => assignment.portions > 0),
                  }
                : {}),
            ...(optimize
                ? {
                      alternatives: alternativeIds.flatMap((id) => {
                          const candidate = recipes.data?.find((item) => item.id === id);
                          return candidate ? [{ recipeId: candidate.id, revisionId: candidate.revisionId }] : [];
                      }),
                      optimization: {
                          priorities: [
                              ...(priorityPreset === 'expiry'
                                  ? (['expiry', 'nutrition', 'budget'] as const)
                                  : priorityPreset === 'nutrition'
                                    ? (['nutrition', 'expiry', 'budget'] as const)
                                    : (['budget', 'expiry', 'nutrition'] as const)),
                          ],
                          maxBudgetMinor: Math.round(maxBudgetRub * 100),
                          targetMealSharePercent: 33,
                      },
                  }
                : {}),
            conflictPolicy: 'skip-existing' as const,
        };
        setPending(true);
        setError('');
        try {
            const result = await api.request('POST /api/v1/meal-plan/automation-preview', {
                version,
                selection,
                rule,
            });
            setFrozenRule(rule);
            setPreview(result.data);
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'Не удалось рассчитать повторение.');
        } finally {
            setPending(false);
        }
    }
    async function commit() {
        if (!api || !preview || !frozenRule) return;
        setPending(true);
        setError('');
        try {
            await api.request('POST /api/v1/meal-plan/automation-commit', {
                version,
                selection,
                rule: frozenRule,
                previewToken: preview.previewToken,
                idempotencyKey: crypto.randomUUID(),
            });
            setPreview(null);
            setFrozenRule(null);
            await onCommitted();
        } catch (reason) {
            setError(reason instanceof ApiError ? reason.message : 'Не удалось применить повторение.');
        } finally {
            setPending(false);
        }
    }
    return (
        <section className={styles.panel}>
            <div className={styles.heading}>
                <div>
                    <h2>{pro ? 'Повторение и оптимизация · Pro' : 'Повторение блюда · Plus'}</h2>
                    <p>
                        {pro
                            ? 'Сравним рецепты по вашим приоритетам и сначала покажем итоговый план.'
                            : 'Сначала покажем реальные даты, конфликты и влияние на запасы и покупки.'}
                    </p>
                </div>
            </div>
            <form className={styles.fields} onSubmit={(event) => void submit(event)}>
                <label>
                    Рецепт
                    <select required value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                        <option value="">Выберите рецепт</option>
                        {recipes.data?.map((recipe) => (
                            <option key={recipe.revisionId} value={recipe.id}>
                                {recipe.title}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!recipes.data?.length}
                        onClick={() => {
                            const candidate =
                                recipes.data?.find((recipe) => recipe.availability?.canPrepare) ?? recipes.data?.[0];
                            if (candidate) setRecipeId(candidate.id);
                        }}
                    >
                        Подобрать по запасам
                    </button>
                </label>
                <label>
                    Приём пищи
                    <select value={meal} onChange={(event) => setMeal(event.target.value as typeof meal)}>
                        <option value="breakfast">Завтрак</option>
                        <option value="lunch">Обед</option>
                        <option value="dinner">Ужин</option>
                        <option value="snack">Перекус</option>
                    </select>
                </label>
                <label>
                    Порции
                    <input
                        type="number"
                        min="1"
                        max="1000"
                        value={portions}
                        onChange={(event) => setPortions(Number(event.target.value))}
                    />
                </label>
                <fieldset className={styles.wide}>
                    <legend>Дни недели</legend>
                    <div className={styles.weekdays}>
                        {weekdays.map(([value, label]) => (
                            <label key={value}>
                                <input
                                    type="checkbox"
                                    checked={days.includes(value)}
                                    onChange={(event) =>
                                        setDays((current) =>
                                            event.target.checked
                                                ? [...current, value]
                                                : current.filter((day) => day !== value),
                                        )
                                    }
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </fieldset>
                {pro && (
                    <fieldset className={styles.wide}>
                        <legend>Детерминированная оптимизация · Pro</legend>
                        <label className={styles.checkbox}>
                            <input
                                type="checkbox"
                                checked={optimize}
                                onChange={(event) => {
                                    setOptimize(event.target.checked);
                                    if (!event.target.checked) setAlternativeIds([]);
                                }}
                            />
                            Чередовать рецепты с учётом сроков, КБЖУ и бюджета
                        </label>
                        {optimize && (
                            <div className={styles['optimization-fields']}>
                                <label>
                                    Главный приоритет
                                    <select
                                        value={priorityPreset}
                                        onChange={(event) =>
                                            setPriorityPreset(event.target.value as typeof priorityPreset)
                                        }
                                    >
                                        <option value="expiry">Сначала продукты с близким сроком</option>
                                        <option value="nutrition">Сначала близость к моей цели КБЖУ</option>
                                        <option value="budget">Сначала бюджет</option>
                                    </select>
                                </label>
                                <label>
                                    Бюджет одного приготовления, ₽
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={maxBudgetRub}
                                        onChange={(event) => setMaxBudgetRub(Number(event.target.value))}
                                    />
                                </label>
                                <fieldset className={styles.wide}>
                                    <legend>Альтернативные рецепты</legend>
                                    <div className={styles['candidate-list']}>
                                        {recipes.data
                                            ?.filter((recipe) => recipe.id !== recipeId)
                                            .slice(0, 9)
                                            .map((recipe) => (
                                                <label key={recipe.revisionId}>
                                                    <input
                                                        type="checkbox"
                                                        checked={alternativeIds.includes(recipe.id)}
                                                        onChange={(event) =>
                                                            setAlternativeIds((current) =>
                                                                event.target.checked
                                                                    ? [...current, recipe.id].slice(0, 9)
                                                                    : current.filter((id) => id !== recipe.id),
                                                            )
                                                        }
                                                    />
                                                    {recipe.title}
                                                </label>
                                            ))}
                                    </div>
                                </fieldset>
                                <p className={styles.muted}>
                                    Алгоритм не использует AI: критерии применяются в указанном порядке, а неизвестные
                                    цены и КБЖУ остаются неизвестными.
                                </p>
                            </div>
                        )}
                    </fieldset>
                )}
                {selection.scope === 'family' && (
                    <fieldset className={styles.wide}>
                        <legend>Распределение порций</legend>
                        <div className={styles.assignments}>
                            {members.map((member) => (
                                <label key={member.userId}>
                                    {member.displayName}
                                    <input
                                        type="number"
                                        min="0"
                                        max={portions}
                                        value={assignments[member.userId] ?? 0}
                                        onChange={(event) =>
                                            setAssignments((current) => ({
                                                ...current,
                                                [member.userId]: Math.max(0, Number(event.target.value)),
                                            }))
                                        }
                                    />
                                </label>
                            ))}
                        </div>
                    </fieldset>
                )}
                <button
                    disabled={
                        pending ||
                        !recipeId ||
                        !days.length ||
                        (optimize && (!alternativeIds.length || maxBudgetRub <= 0)) ||
                        recipes.isPending ||
                        Object.values(assignments).reduce((sum, value) => sum + value, 0) > portions
                    }
                >
                    {pending ? <ArcInlineLoader label="Считаем…" /> : 'Показать preview'}
                </button>
            </form>
            {error && <p role="alert">{error}</p>}
            {preview && (
                <div className={styles['automation-preview']} aria-live="polite">
                    <h3>Будет добавлено: {preview.occurrences}</h3>
                    <p>
                        Занятые приёмы пищи пропущены: {preview.conflicts.length}. Существующие и закреплённые записи не
                        изменятся.
                    </p>
                    {preview.optimization && (
                        <div>
                            <h3>Порядок кандидатов</h3>
                            <ol className={styles.impact}>
                                {preview.optimization.candidates.map((candidate) => (
                                    <li key={candidate.revisionId}>
                                        <strong>{candidate.title}</strong> · срок: {candidate.expiringIngredientCount} ·
                                        КБЖУ: {candidate.nutritionCompletenessPercent}% · стоимость:{' '}
                                        {candidate.estimatedPriceMinor === null
                                            ? 'неизвестна'
                                            : `${(candidate.estimatedPriceMinor / 100).toLocaleString('ru-RU')} ₽`}
                                    </li>
                                ))}
                            </ol>
                            {!!preview.optimization.warnings.length && (
                                <p className={styles.muted}>
                                    Неполные данные: результат не подменяет отсутствующие цены, КБЖУ или цель нулями.
                                </p>
                            )}
                        </div>
                    )}
                    {preview.conflicts.length > 0 && (
                        <ul className={styles.impact}>
                            {preview.conflicts.slice(0, 10).map((conflict) => (
                                <li key={`${conflict.date}:${conflict.meal}`}>
                                    {new Date(`${conflict.date}T12:00:00Z`).toLocaleDateString('ru-RU')} · занято
                                    {conflict.locked ? ' и закреплено' : ''}
                                </li>
                            ))}
                        </ul>
                    )}
                    <p>
                        Потребностей в продуктах: {preview.impact.items.length}. Неизвестные количества требуют проверки
                        и не считаются нулём.
                    </p>
                    <div className={styles['row-actions']}>
                        <button disabled={pending || preview.occurrences === 0} onClick={() => void commit()}>
                            {pending ? <ArcInlineLoader label="Применяем…" /> : 'Применить повторение'}
                        </button>
                        <button
                            disabled={pending}
                            onClick={() => {
                                setPreview(null);
                                setFrozenRule(null);
                            }}
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
