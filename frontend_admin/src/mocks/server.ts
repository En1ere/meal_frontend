import { setupServer } from 'msw/node';
import { MockApi, type MockOptions } from './api.js';
import { createHandlers } from './handlers.js';
import { MemoryRepository } from './repository.js';

// Per test/request context, never a server-global private store for SSR users.
export function createMockServer(options: MockOptions) {
    const repository = new MemoryRepository();
    const api = new MockApi(repository, options);
    return { server: setupServer(...createHandlers(api, options.origin)), repository, api };
}
