# 캐릭터·몬스터 PNG와 JSON

새 에셋은 관리자 코스튬/몬스터 등록·상세의 PNG와 JSON 입력에서 함께 올린다. 등록 시 둘 다 생략할 수 있지만, 하나만 올리는 것은 거절한다. 교체도 두 파일을 함께 올린다. 기존 JSON 없는 코스튬의 고정 배치와 몬스터의 단일 이미지는 계속 동작한다.

## 지원하는 내보내기 형식

사용자가 제공한 `green_small_slime-Idle.json`의 `spritesheet.rows` 내보내기 형식을 지원한다. 임의의 다른 JSON 형식을 자동 해석하지는 않는다. PNG 파일 경로나 JSON의 `spritesheet.path`로 외부 파일을 읽지 않으며 실제 함께 업로드한 PNG를 사용한다.

```json
{
  "spritesheet": {
    "cell_size": { "width": 36, "height": 36 },
    "sheet_size": { "width": 144, "height": 108 },
    "columns": 4,
    "pivot": "cell-center",
    "rows": [
      { "row": 0, "type": "rotations", "frame_count": 2, "directions": ["east", "west"] },
      { "row": 1, "type": "animation", "frame_count": 4, "animation": "Walking", "direction": "east", "fps": 8 },
      { "row": 2, "type": "animation", "frame_count": 4, "animation": "Walking", "direction": "west", "fps": 8 }
    ]
  }
}
```

- `row`와 열 번호는 0부터 시작한다. JSON 배열 순서와 무관하게 실제 `row`를 사용한다. 같은 PNG의 셀 크기는 일정하며 셀 간 여백은 없다.
- `rotations`의 각 열은 `directions` 순서의 대기 프레임이다. 같은 방향의 대기 애니메이션이 있으면 그것을 우선한다.
- `animation`의 `direction: "east"`는 한 방향 전용이며, `directions: ["east", "west"]`는 같은 프레임을 양쪽 방향에서 공용으로 재생한다. 두 필드를 동시에 지정하거나 방향을 중복할 수 없다. 공용 피격·사망 이미지를 방향별로 복사하거나 반전할 필요가 없다.
- `animation`은 해당 행의 0번 열부터 `frame_count`개를 재생한다. 선택적으로 `frames: [3, 0, 2, 1]`처럼 열 번호 재생 순서를 지정할 수 있다. `frame_indices`는 시트 전체에서 왼쪽→오른쪽, 위→아래로 센 0부터 시작하는 프레임 번호 배열이며 명시한 순서로 재생한다. `frames`와 동시에 지정할 수 없다. `source_frame_indices`는 원본 에셋의 참고 정보이며 재생 위치로 사용하지 않는다.
- `fps` 또는 `frame_rate`는 1~60이며 생략하면 8이다. 대기·걷기는 반복하고 다른 동작은 한 번 재생한다.
- 방향은 east/west/north/south/north-east/north-west/south-east/south-west다. 밑줄 표기 및 northeast 등의 붙여쓴 표기도 지원한다. 벨트스크롤 게임에서는 동·서만 사용한다.
- 현재 배치는 캐릭터 발 기준 `.5, .875`, 몬스터 발 기준 `.5, 1`을 유지한다. JSON의 pivot은 내보내기 셀 기준점 설명이며 게임 배치 기준을 바꾸지 않는다. cell-center/bottom-center만 허용한다.
- 동쪽·서쪽 각각 대기 또는 걷기 정보가 필요하다. 대기가 없으면 걷기 첫 프레임을 사용하며 걷기가 없으면 대기를 유지한다.

## 동작 연결

| 게임 동작 | 자동 인식 이름 |
|---|---|
| idle | Idle, Standing, 대기, 서있기 |
| walk | Walk, Walking, Run, Running, 걷기, 이동, 달리기 |
| attack | Attack, Attacking, 공격, 이름에 `박치기` 포함 |
| jump | Jump, Jumping, 점프 |
| hurt | Hurt, Hit, Damage, 피격 |
| death | Death, Dead, Die, Dying, 사망, 죽음 |

영문 대소문자는 구분하지 않는다. 이름이 다르면 JSON 해당 행에 `"action": "attack"`처럼 명시한다. 알 수 없는 동작이나 중복 동작·방향은 저장 전에 오류로 안내한다. 점프·공격·피격·사망 에셋은 선택 사항이며 누락하면 기존 이동·스윙·깜빡임·페이드 효과를 유지한다. 캐릭터 공격은 기존 300ms 스윙 시간에 맞춰 전체 프레임을 재생한다. 몬스터 점프는 현재 AI 동작에 없으므로 재생하지 않는다.

## 검증·저장·조회

PNG는 최대 2048×2048·5MB, JSON은 256KB, 행은 256개, 전체 프레임은 4096개까지다. 셀 크기·시트 크기·열 수·프레임 수와 PNG 실제 크기를 검증하며 모든 프레임은 시트 안에 있어야 한다.

V18은 `gm_costume.sprite_json`, `gm_monster.sprite_json`만 추가한다. JSON을 검증 후 프레임 사각형·동작 목록으로 정규화하고, PNG 키와 같은 트랜잭션으로 저장한다. PNG는 기존 스토리지에 원본 그대로 저장한다. DB 롤백 시 새 PNG를 정리하며 이전 PNG는 기존 정책대로 보존한다.

인증된 게임 API `/api/costumes/{code}/sprite`, `/api/monsters/{id}/sprite`가 정규화 JSON을 `no-store`로 전달한다. 기존 에셋은 JSON `null`을 반환한다. 관리자 상세의 애니메이션 정보 링크도 정규화된 런타임 정보이며, 재업로드에는 원본 내보내기 JSON을 사용한다.

선택창은 JSON의 동쪽 걷기 전체 프레임을 재생하며 동작 줄이기 설정에서는 동쪽 대기를 표시한다. 인게임 캐릭터 셀 높이는 96px, 몬스터 셀의 긴 변은 80px로 맞추며 종횡비를 유지한다. JSON 변경을 적용하려면 게임을 다시 입장한다.

검증에는 실제 제공된 슬라임 288×180/36×36 PNG·JSON을 사용한다. 걷기 동·서 8프레임, 공격 동·서 5프레임 및 대기 2방향을 확인한다.

캐릭터의 실제 `common_character_01_belt.json`·64×224 PNG도 회귀 자료로 사용한다. 동·서 걷기·점프와 공용 Hit(1프레임)·Death(2프레임)를 모두 검증한다.
