import { request } from '../api/request';
import type { BattleInput, BattlePrediction, BattleState } from './battleTypes';

export function connectBattle(characterId: string, input: () => BattleInput,
    apply: (state: BattleState, entering: boolean, prediction?: BattlePrediction) => void, status: (message: string) => void) {
    const abort = new AbortController();
    let sessionId: string | undefined;
    let csrf: { headerName: string; token: string } | undefined;
    let seq = 0;
    let inFlight = false;
    let urgent = false;
    let timer: ReturnType<typeof setTimeout>;
    const path = `/api/characters/${encodeURIComponent(characterId)}/battle`;
    async function poll() {
        if (inFlight || abort.signal.aborted) return;
        inFlight = true;
        let delay = 120;
        try {
            csrf ??= await request('/api/auth/csrf', { signal: abort.signal });
            const entering = !sessionId;
            const snapshot = entering ? undefined : input();
            const { prediction, ...command } = snapshot ?? {};
            const state = await request<BattleState>(entering ? path : `${path}/tick`, {
                method: 'POST', signal: abort.signal,
                headers: { 'Content-Type': 'application/json', [csrf!.headerName]: csrf!.token },
                body: entering ? undefined : JSON.stringify({ ...command, sessionId, seq: ++seq })
            });
            if (abort.signal.aborted) return;
            sessionId = state.sessionId;
            apply(state, entering, prediction);
            status('');
        } catch (cause) {
            if (abort.signal.aborted) return;
            csrf = undefined;
            // Keep the session so reconnects do not reset a paid monster kill.
            // Transient popup effects from a lost response are not replayed.
            status(cause instanceof TypeError ? '전투 서버 연결이 끊겼어요. 다시 연결하고 있어요.'
                : cause instanceof Error ? cause.message : '전투 연결을 확인하고 있어요.');
            delay = 2000;
        }
        inFlight = false;
        if (!abort.signal.aborted) timer = setTimeout(() => void poll(), urgent && delay < 2000 ? 0 : delay);
        urgent = false;
    }
    void poll();
    const dispose = () => { abort.abort(); clearTimeout(timer); };
    dispose.wake = () => {
        if (abort.signal.aborted) return;
        if (inFlight) urgent = true;
        else { clearTimeout(timer); void poll(); }
    };
    return dispose;
}
