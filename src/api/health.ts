export interface HealthResponse {
    status: 'UP';
    service: 'mokdo-backend';
}

export async function fetchHealth(): Promise<HealthResponse> {
    const response = await fetch('/api/health', {
        signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
        throw new Error(`Health API 요청 실패: HTTP ${response.status} ${response.statusText}`);
    }

    const data: unknown = await response.json();

    if (
        typeof data !== 'object' || data === null ||
        !('status' in data) || data.status !== 'UP' ||
        !('service' in data) || data.service !== 'mokdo-backend'
    ) {
        throw new Error('Health API 응답 형식이 올바르지 않습니다.');
    }

    return { status: data.status, service: data.service };
}
