'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../app/providers.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import styles from './family.module.css';

export function OwnershipNotice() {
    const { api, queryClient } = useRuntime();
    const key = useRef(crypto.randomUUID());
    const dialog = useRef<HTMLDialogElement>(null);
    const query = useQuery({
        queryKey: ['family-ownership-notice'],
        enabled: !!api,
        queryFn: async ({ signal }) =>
            (await api!.request('GET /api/v1/family/ownership-notice', undefined, signal)).data,
    });
    const dismiss = useMutation({
        mutationFn: async () => {
            if (!query.data?.notice) throw new Error('Notice missing');
            return (
                await api!.request('POST /api/v1/family/ownership-notice/dismiss', {
                    notificationId: query.data.notice.notificationId,
                    expectedVersion: query.data.notice.version,
                    idempotencyKey: key.current,
                })
            ).data;
        },
        onSuccess: () => {
            queryClient.setQueryData(['family-ownership-notice'], { notice: null });
            void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
    const notice = query.data?.notice;
    useEffect(() => {
        const node = dialog.current;
        if (notice && node && !node.open) node.showModal();
    }, [notice]);
    if (!notice) return null;
    return (
        <dialog
            ref={dialog}
            className={`${styles.modal} ${styles['ownership-modal']}`}
            aria-labelledby="ownership-title"
            onCancel={(event) => event.preventDefault()}
        >
            <p className={styles.eyebrow}>Важное семейное событие</p>
            <h2 id="ownership-title">{notice.title}</h2>
            <p>{notice.body}</p>
            {dismiss.isError && <p role="alert">Не удалось закрыть уведомление. Попробуйте ещё раз.</p>}
            <button className="button primary" disabled={dismiss.isPending} onClick={() => dismiss.mutate()}>
                {dismiss.isPending && <ArcInlineLoader label={null} />}Понятно
            </button>
        </dialog>
    );
}
