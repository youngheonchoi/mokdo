export async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
    if (response.status === 401) {
        window.location.assign('/');
        throw new Error('로그인이 만료됐어요. 다시 로그인해 주세요.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.message || (response.status === 403
            ? '요청을 완료하지 못했어요. 새로고침 후 다시 시도해 주세요.'
            : '서버 요청에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    }
    return data as T;
}

