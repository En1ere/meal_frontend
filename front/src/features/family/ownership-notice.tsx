'use client';

import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRuntime } from '../../shared/runtime/index.js';
import { InlineLoader as ArcInlineLoader } from '@meal-planner/design-system';
import { notificationKeys } from '../../entities/notification/model.js';
import { familyProjectionKeys } from './query-keys.js';
import styles from './family.module.css';
import { dismissFamilyOwnershipNotice, loadFamilyOwnershipNotice } from './api.js';

export function OwnershipNotice() {
    const { api, queryClient } = useRuntime();
    const key = useRef(crypto.randomUUID());
    const dialog = useRef<HTMLDialogElement>(null);
    const query = useQuery({
        queryKey: familyProjectionKeys.ownershipNotice,
        enabled: !!api,
        queryFn: ({ signal }) => loadFamilyOwnershipNotice(api!, signal),
    });
    const dismiss = useMutation({
        mutationFn: async () => {
            if (!query.data?.notice) throw new Error('Notice missing');
            return dismissFamilyOwnershipNotice(api!, {
                notificationId: query.data.notice.notificationId,
                expectedVersion: query.data.notice.version,
                idempotencyKey: key.current,
            });
        },
        onSuccess: () => {
            queryClient.setQueryData(familyProjectionKeys.ownershipNotice, { notice: null });
            void queryClient.invalidateQueries({ queryKey: notificationKeys.root });
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
