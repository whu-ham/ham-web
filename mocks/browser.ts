/**
 * @author Claude
 * @version 1.1
 * @date 2026/9/23 00:41:00
 *
 * MSW browser worker setup.
 * Initializes the Service Worker with mock handlers.
 */
import { setupWorker } from 'msw/browser';
import { authHandlers, tokenHandlers } from './handlers';

export const worker = setupWorker(...authHandlers, ...tokenHandlers);
