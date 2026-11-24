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
    constructor(public readonly status: number) {
        super(`API request failed: ${status}`);
    }
}

async function request(path: string, signal: AbortSignal, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(path, {
        ...init, credentials: 'same-origin', cache: 'no-store',
        signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
    });
    if (!response.ok) throw new ApiError(response.status);
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
