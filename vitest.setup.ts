/**
 * @author Claude
 * @version 1.0
 * @date 2026/9/26 12:20:00
 *
 * Global Vitest setup shared by every unit-test file.
 *
 * Tests render hooks and components through React Testing Library, which
 * only unmounts automatically when `afterEach` is a global. This project
 * imports the test API explicitly (`import { afterEach } from 'vitest'`),
 * so the cleanup has to be registered by hand — otherwise a rendered tree
 * survives into the next test and leaks timers, listeners and state.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
	cleanup();
});
