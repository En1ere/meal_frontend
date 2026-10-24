'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { ApiError } from '../../shared/api/client.js';
import { useSession } from '../auth/session.js';
import { useRequestSignal } from '../auth/use-request-signal.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { InventoryShell, Loading, Failure, units, commandError } from '../inventory/shared.js';
import styles from '../inventory/inventory.module.css';
import productStyles from './products.module.css';
type AllergenStatus = 'contains' | 'may_contain' | 'unknown';
function Content() {
    const { api, queryClient } = useRuntime();
    const user = useSession('user');
    const router = useRouter();
    const signal = useRequestSignal();
    const [pending, setPending] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [error, setError] = useState('');
    const [allergens, setAllergens] = useState<Record<string, AllergenStatus>>({});
    const attempt = useRef<{ key: string; fingerprint: string } | null>(null);
    const reference = useQuery({
        queryKey: ['product-reference', user.data?.id],
        enabled: !!api && !!user.data,
        queryFn: async ({ signal }) => (await api!.request('GET /api/v1/products/reference', undefined, signal)).data,
    });
    const savedBody = useRef<Record<string, unknown> | null>(null);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!api || pending) return;
        const form = new FormData(event.currentTarget);
        const text = (key: string) => {
            const value = form.get(key);
            return typeof value === 'string' ? value.trim() : '';
        };
        const body =
            uncertain && savedBody.current
                ? savedBody.current
                : {
                      name: text('name'),
                      categoryId: text('categoryId'),
                      unit: text('unit'),
                      brand: text('brand') || null,
                      packageQuantity: text('packageQuantity').replace(',', '.') || null,
                      barcode: text('barcode') || null,
                      compositionText: text('compositionText') || null,
                      kcal: text('kcal').replace(',', '.') || null,
                      protein: text('protein').replace(',', '.') || null,
                      fat: text('fat').replace(',', '.') || null,
                      carbs: text('carbs').replace(',', '.') || null,
                      nutritionBasisUnit: text('nutritionBasisUnit'),
                      allergens: Object.entries(allergens).map(([code, status]) => ({ code, status })),
                      source: 'user',
                      sourceText: text('sourceText') || null,
                  };
        const fingerprint = JSON.stringify(body);
        if (!attempt.current || attempt.current.fingerprint !== fingerprint)
            attempt.current = { key: crypto.randomUUID(), fingerprint };
        savedBody.current = body;
        setPending(true);
        setError('');
        const abort = signal();
        try {
            const response = await api.request(
                'POST /api/v1/products/proposals',
                { ...body, idempotencyKey: attempt.current.key },
                abort,
            );
            if (abort.aborted) return;
            await queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
            router.push(`/products/${response.data.product.id}`);
        } catch (err) {
            if (!abort.aborted) {
                setError(commandError(err));
                setUncertain(!(err instanceof ApiError) || err.status >= 500);
                if (err instanceof ApiError && err.status < 500) attempt.current = null;
            }
        } finally {
            if (!abort.aborted) setPending(false);
        }
    }
    return (
        <>
            <Link href="/inventory/new">← К добавлению партии</Link>
            <h1>Предложить новый продукт</h1>
            <p className={styles.notice}>
                После сохранения продукт сразу доступен вам. Для общего каталога его проверит модератор. Пустые
                необязательные поля останутся неизвестными.
            </p>
            {reference.isPending ? (
                <Loading />
            ) : reference.isError ? (
                <Failure error={reference.error} retry={() => void reference.refetch()} />
            ) : (
                <form onSubmit={(event) => void submit(event)} className={styles.form}>
                    <fieldset disabled={pending || uncertain} className={styles.lockable}>
                        <div className={styles.columns}>
                            <section className={styles.card}>
                                <h2>Товар</h2>
                                <label>
                                    Название
                                    <input name="name" required maxLength={200} />
                                </label>
                                <label>
                                    Категория
                                    <select name="categoryId" required defaultValue="">
                                        <option value="">Выберите категорию</option>
                                        {reference.data.categories.map((x) => (
                                            <option key={x.id} value={x.id}>
                                                {x.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Бренд
                                    <input name="brand" maxLength={120} />
                                </label>
                                <div className={styles.columns}>
                                    <label>
                                        Количество в упаковке
                                        <input
                                            name="packageQuantity"
                                            inputMode="decimal"
                                            pattern="[0-9]+([.,][0-9]{1,8})?"
                                        />
                                    </label>
                                    <label>
                                        Единица
                                        <select name="unit" defaultValue="g">
                                            {Object.entries(units).map(([value, label]) => (
                                                <option value={value} key={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <label>
                                    Штрихкод
                                    <input
                                        name="barcode"
                                        inputMode="numeric"
                                        pattern="([0-9]{8}|[0-9]{12,14})"
                                        maxLength={14}
                                    />
                                    <small>EAN/UPC/GTIN. Контрольная цифра проверяется при сохранении.</small>
                                </label>
                                <label>
                                    Состав
                                    <textarea name="compositionText" maxLength={10000} rows={5} />
                                </label>
                                <label>
                                    Источник сведений
                                    <textarea
                                        name="sourceText"
                                        maxLength={20000}
                                        rows={3}
                                        placeholder="Например, текст с этикетки"
                                    />
                                </label>
                            </section>
                            <section className={styles.card}>
                                <h2>Пищевая ценность</h2>
                                <label>
                                    Значения на 100
                                    <select name="nutritionBasisUnit" defaultValue="g">
                                        <option value="g">граммов</option>
                                        <option value="ml">миллилитров</option>
                                    </select>
                                </label>
                                {[
                                    ['kcal', 'Калории, ккал'],
                                    ['protein', 'Белки, г'],
                                    ['fat', 'Жиры, г'],
                                    ['carbs', 'Углеводы, г'],
                                ].map(([name, label]) => (
                                    <label key={name}>
                                        {label}
                                        <input name={name} inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,8})?" />
                                    </label>
                                ))}
                                <p>
                                    Неизвестные значения оставьте пустыми. Ноль указывайте только когда он подтверждён.
                                </p>
                            </section>
                        </div>
                        <section className={styles.card}>
                            <h2>Аллергены</h2>
                            <p>Неизвестный состав не означает отсутствие аллергенов.</p>
                            <div className={productStyles.allergens}>
                                {reference.data.allergens.map((item) => (
                                    <label key={item.code}>
                                        {item.name}
                                        <select
                                            value={allergens[item.code] ?? ''}
                                            onChange={(event) => {
                                                const next = { ...allergens };
                                                const value = event.target.value;
                                                if (value) next[item.code] = value as AllergenStatus;
                                                else delete next[item.code];
                                                setAllergens(next);
                                            }}
                                        >
                                            <option value="">Нет сведений</option>
                                            <option value="contains">Содержит</option>
                                            <option value="may_contain">Может содержать</option>
                                            <option value="unknown">Неизвестно</option>
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </section>
                    </fieldset>
                    {error && (
                        <p role="alert" className={styles.notice}>
                            {error}
                        </p>
                    )}
                    <button className="button primary" disabled={pending}>
                        {pending ? (
                            <ArcInlineLoader label="Сохраняем" />
                        ) : uncertain ? (
                            'Повторить тот же запрос'
                        ) : (
                            'Создать и отправить на проверку'
                        )}
                    </button>
                </form>
            )}
        </>
    );
}
export function ProductNewPage() {
    return (
        <InventoryShell>
            <Content />
        </InventoryShell>
    );
}
