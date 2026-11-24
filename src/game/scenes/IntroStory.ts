import { ApiError, completeCharacterIntro, fetchCharacter } from '../../api/auth';
import { AccountScreen } from './AccountScreen';

const panels = [
    { title: '낯선 아침', text: '눈을 뜨자, 처음 보는 나무 아래였다. 손끝에 닿은 바람이 조용히 속삭였다.', quote: '여기는… 어디지?', position: '0% 0%', alt: '커다란 나무 아래에서 눈뜬 졸라맨과 빛나는 초록 씨앗' },
    { title: '작은 길잡이', text: '초록빛 씨앗 하나가 눈앞에 둥실 떠올랐다. 잠시 머뭇거리더니, 숲길 쪽으로 천천히 움직였다.', quote: '따라오라는 건가?', position: '100% 0%', alt: '빛나는 씨앗을 따라 햇살이 드는 숲길을 걷는 졸라맨' },
    { title: '다리 너머로', text: '물소리를 따라 다리를 건너자, 멀리 지붕들이 보이기 시작했다. 어딘가에서 따뜻한 빵 냄새가 났다.', quote: '저쪽에 누군가 살고 있어.', position: '0% 100%', alt: '맑은 시냇물 위의 나무다리를 건너는 졸라맨' },
    { title: '새로운 시작', text: '씨앗이 멈춘 곳에는 커다란 나무를 품은 작은 마을이 있었다. 아직 아무것도 모르지만, 왠지 좋은 일이 생길 것 같았다.', quote: '좋아. 여기서 시작해보자!', position: '100% 100%', alt: '커다란 나무와 아늑한 집들이 있는 마을에 도착한 졸라맨' }
];

export class IntroStory extends AccountScreen {
    private characterId: string;

    constructor() { super('IntroStory'); }

    init(data: { characterId?: string }): void {
        this.characterId = data.characterId || '';
    }

    create(): void {
        if (!this.characterId) { this.scene.start('CharacterSelect'); return; }
        this.mount('작은 빛이 이끄는 곳', '첫 번째 이야기');
        this.panel.classList.add('webtoon-panel');
        this.status.classList.add('visually-hidden');
        const signal = this.abort.signal;
        let ready = false;
        let saving = false;
        const feedback = document.createElement('p');
        feedback.className = 'story-feedback';
        feedback.setAttribute('role', 'alert');
        feedback.hidden = true;
        const enter = (): void => {
            if (!ready || saving) return;
            saving = true;
            skip.disabled = finish.disabled = back.disabled = true;
            feedback.hidden = true;
            finish.textContent = '마을로 가는 중…';
            void completeCharacterIntro(this.characterId, signal).then(() => {
                if (!signal.aborted) this.scene.start('Village', { characterId: this.characterId });
            }).catch((error: unknown) => {
                if (signal.aborted) return;
                if (this.handleUnavailable(error)) return;
                feedback.textContent = '진행 상황을 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
                feedback.hidden = false;
            }).finally(() => {
                if (signal.aborted) return;
                saving = false;
                skip.disabled = finish.disabled = back.disabled = false;
                finish.textContent = '마을로 가기';
            });
        };
        const skip = this.button('SKIP', enter, 'story-skip');
        skip.setAttribute('aria-label', 'SKIP · 이야기 건너뛰고 마을로 가기');
        skip.disabled = true;
        for (const [index, panel] of panels.entries()) {
            const section = document.createElement('section');
            section.className = 'webtoon-cut';
            const art = document.createElement('div');
            art.className = 'webtoon-art';
            art.style.backgroundPosition = panel.position;
            art.setAttribute('role', 'img');
            art.setAttribute('aria-label', panel.alt);
            const number = document.createElement('p');
            number.className = 'webtoon-number';
            number.textContent = `0${index + 1} / ${panel.title}`;
            const narration = document.createElement('p');
            narration.className = 'webtoon-narration';
            narration.textContent = panel.text;
            const quote = document.createElement('blockquote');
            quote.textContent = `“${panel.quote}”`;
            section.append(art, number, narration, quote);
            this.panel.append(section);
        }
        const finish = this.button('마을로 가기', enter);
        finish.disabled = true;
        const back = this.button('캐릭터 선택으로', () => { this.scene.start('CharacterSelect'); }, 'secondary');
        const retry = this.button('다시 연결', () => { void load(); }, 'secondary');
        retry.hidden = true;
        this.panel.append(skip, finish, back, retry, feedback);
        const load = async (): Promise<void> => {
            retry.hidden = true;
            feedback.hidden = true;
            try {
                const character = await fetchCharacter(this.characterId, signal);
                if (signal.aborted) return;
                if (character.introCompletedAt) {
                    this.scene.start('Village', { characterId: this.characterId });
                    return;
                }
                ready = true;
                skip.disabled = finish.disabled = false;
            } catch (error: unknown) {
                if (signal.aborted || this.handleUnavailable(error)) return;
                feedback.textContent = '캐릭터 정보를 확인하지 못했어요. 다시 연결해주세요.';
                feedback.hidden = retry.hidden = false;
            }
        };
        void load();
    }

    private handleUnavailable(error: unknown): boolean {
        if (error instanceof ApiError && error.status === 401) {
            this.scene.start('MainMenu');
            return true;
        }
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            this.scene.start('CharacterSelect');
            return true;
        }
        return false;
    }
}
