import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '@/mocks/server';
import { resetarBanco } from '@/mocks/db';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); resetarBanco(); });
afterAll(() => server.close());

// jsdom não tem ResizeObserver (o Recharts precisa dele).
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
