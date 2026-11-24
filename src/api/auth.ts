export interface Account {
    id: string;
    status: 'ACTIVE';
}

export interface CharacterSummary {
    id: string;
    slotNo: number;
    name: string;
    appearanceCode: string | null;
    introCompletedAt: string | null;
}

export class ApiError extends Error {
    constructor(public readonly status: number, public readonly code = 'request_failed') {
        super(`API request failed: ${status}`);
    }
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(path, {
        ...init, credentials: 'same-origin', cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
    });
    if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code : 'request_failed';
        throw new ApiError(response.status, code);
    }
    return response;
}

export async function fetchMe(signal: AbortSignal): Promise<Account> {
    const data: unknown = await (await request('/api/me', signal)).json();
    if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string'
        || !('status' in data) || data.status !== 'ACTIVE') {
        throw new Error('Invalid account response');
    }
    return { id: data.id, status: data.status };
}

export async function fetchCharacters(signal: AbortSignal): Promise<CharacterSummary[]> {
    const data: unknown = await (await request('/api/characters', signal)).json();
    if (!Array.isArray(data) || !data.every((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        return 'id' in item && typeof item.id === 'string'
            && 'slotNo' in item && typeof item.slotNo === 'number' && Number.isInteger(item.slotNo)
            && 'name' in item && typeof item.name === 'string'
            && 'appearanceCode' in item && (item.appearanceCode === null || typeof item.appearanceCode === 'string')
            && 'introCompletedAt' in item && (item.introCompletedAt === null || typeof item.introCompletedAt === 'string');
    })) throw new Error('Invalid character response');
    return data as CharacterSummary[];
}

export function startGoogleLogin(): void {
    const backend = import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:8081';
    window.location.assign(new URL('/oauth2/authorization/google', backend).href);
}

export async function logout(signal: AbortSignal): Promise<void> {
    const csrf = await (await request('/api/csrf', signal)).json() as { headerName: string; token: string };
    await request('/api/logout', signal, {
        method: 'POST', headers: { [csrf.headerName]: csrf.token }
    });
}

async function mutate(path: string, method: string, body: unknown, signal: AbortSignal): Promise<Response> {
    const csrf = await (await request('/api/csrf', signal)).json() as { headerName: string; token: string };
    return request(path, signal, {
        method,
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify(body)
    });
}

export async function checkCharacterName(name: string, signal: AbortSignal): Promise<boolean> {
    const data: unknown = await (await request(`/api/characters/name-availability?${new URLSearchParams({ name })}`, signal)).json();
    if (!data || typeof data !== 'object' || !('available' in data) || typeof data.available !== 'boolean') {
        throw new Error('Invalid name availability response');
    }
    return data.available;
}

export async function createCharacter(name: string, signal: AbortSignal): Promise<void> {
    await mutate('/api/characters', 'POST', { name }, signal);
}

export async function deleteCharacter(id: string, confirmationName: string, signal: AbortSignal): Promise<void> {
    await mutate(`/api/characters/${encodeURIComponent(id)}`, 'DELETE', { confirmationName }, signal);
}

export function normalizeCharacterName(name: string): string {
    return name.trim().normalize('NFC');
}

export function isValidCharacterName(name: string): boolean {
    return /^[가-힣A-Za-z0-9]{2,12}$/.test(normalizeCharacterName(name));
}

export async function fetchCharacter(id: string, signal: AbortSignal): Promise<CharacterSummary> {
    const data: unknown = await (await request(`/api/characters/${encodeURIComponent(id)}`, signal)).json();
    if (!data || typeof data !== 'object' || !('id' in data) || data.id !== id
        || !('name' in data) || typeof data.name !== 'string'
        || !('introCompletedAt' in data) || (data.introCompletedAt !== null && typeof data.introCompletedAt !== 'string')) {
        throw new Error('Invalid character response');
    }
    return data as CharacterSummary;
}

export async function completeCharacterIntro(id: string, signal: AbortSignal): Promise<void> {
    await mutate(`/api/characters/${encodeURIComponent(id)}/intro-completion`, 'POST', {}, signal);
}
