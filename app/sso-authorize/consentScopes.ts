import type { ConsentScopeDetail } from '@/services/sso/api';

export type ConsentScopeCategory = 'identity' | 'mcp' | 'other';

export interface ConsentScopeGroup {
	category: ConsentScopeCategory;
	scopes: ConsentScopeDetail[];
}

const normalizeScopeCategory = (
	scope: ConsentScopeDetail
): ConsentScopeCategory => {
	if (scope.category === 'mcp') return 'mcp';
	if (scope.category === 'identity' || scope.category === 'profile') {
		return 'identity';
	}
	if (scope.category) return 'other';
	if (scope.scope.startsWith('mcp:')) return 'mcp';
	return 'identity';
};

export const groupConsentScopes = (
	scopes: ConsentScopeDetail[]
): ConsentScopeGroup[] => {
	const groups = new Map<ConsentScopeCategory, ConsentScopeDetail[]>();
	const order: ConsentScopeCategory[] = ['identity', 'mcp', 'other'];

	scopes.forEach((scope) => {
		const category = normalizeScopeCategory(scope);
		groups.set(category, [...(groups.get(category) ?? []), scope]);
	});

	return order
		.map((category) => ({ category, scopes: groups.get(category) ?? [] }))
		.filter((group) => group.scopes.length > 0);
};

export const withRequiredConsentScopes = (
	nextScopes: string[],
	allScopes: ConsentScopeDetail[]
): string[] => {
	const next = new Set(nextScopes);
	allScopes.forEach((scope) => {
		if (scope.required) next.add(scope.scope);
	});
	return Array.from(next);
};
