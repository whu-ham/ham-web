/**
 * MSW browser worker setup.
 * Initializes the Service Worker with mock handlers.
 */
import { setupWorker } from 'msw/browser';
import { authHandlers, tokenHandlers } from './handlers';

export const worker = setupWorker(...authHandlers, ...tokenHandlers);
