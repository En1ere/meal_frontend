import { createSeed, mockStateSchema, type MockState, type Repository } from './model.js';
import { enrichAdminFixtures } from './scenario-data.js';
import { seedBillingFixtures } from './billing-workspace.js';
import { seedGovernanceFixtures } from './governance-fixtures.js';
import { ensureReviewFixtures } from './review-workspace.js';
import { ensureNewsFixtures } from './news-fixtures.js';

export class MemoryRepository implements Repository {
    private state = createSeed();
    private queue = Promise.resolve();
    transaction<T>(work: (state: MockState) => T): Promise<T> {
        const job = this.queue.then(() => {
            const next = structuredClone(this.state);
            enrichAdminFixtures(next.admin);
            seedBillingFixtures(next);
            seedGovernanceFixtures(next);
            ensureReviewFixtures(next.admin);
            ensureNewsFixtures(next.admin);
            const result = work(next);
            this.state = next;
            return result;
        });
        this.queue = job.then(
            () => undefined,
            () => undefined,
        );
        return job;
    }
}

export class IndexedDbRepository implements Repository {
    constructor(private readonly name = 'meal-planner-admin-api-v1-mock') {}
    async transaction<T>(work: (state: MockState) => T): Promise<T> {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.name, 1);
            request.onupgradeneeded = () => {
                request.result.createObjectStore('state');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Cannot open mock storage'));
        });
        try {
            return await new Promise<T>((resolve, reject) => {
                const transaction = database.transaction('state', 'readwrite');
                const store = transaction.objectStore('state');
                const request = store.get('current') as IDBRequest<unknown>;
                let result: T;
                let failure: unknown;
                transaction.oncomplete = () => resolve(result);
                transaction.onabort = () =>
                    reject(failure instanceof Error ? failure : new Error('Mock storage transaction aborted'));
                transaction.onerror = () => {
                    /* onabort delivers the terminal error */
                };
                request.onsuccess = () => {
                    try {
                        const state =
                            request.result === undefined ? createSeed() : mockStateSchema.parse(request.result);
                        enrichAdminFixtures(state.admin);
                        seedBillingFixtures(state);
                        seedGovernanceFixtures(state);
                        ensureReviewFixtures(state.admin);
                        ensureNewsFixtures(state.admin);
                        result = work(state);
                        if (result instanceof Promise) throw new Error('Mock transactions must be synchronous');
                        store.put(state, 'current');
                    } catch (error) {
                        failure = error;
                        transaction.abort();
                    }
                };
            });
        } finally {
            database.close();
        }
    }
}
