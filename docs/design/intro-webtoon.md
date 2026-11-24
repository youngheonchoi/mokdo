# 임시 인트로 웹툰

- 제작: 내장 image_gen 도구 (CLI 사용 없음)
- 이미지: `public/assets/mokdo-intro-panels.png`
- 구성: 2×2 이미지의 네 영역을 CSS로 나누어 세로 스크롤 4컷으로 표시
- 내레이션과 대사: `src/game/scenes/IntroStory.ts`에서 별도 관리
- 흐름: 낯선 아침 → 씨앗을 따라 숲길 → 다리 → 마을 도착
- SKIP과 마지막 버튼은 동일한 완료 저장 API를 사용하며 성공 후 임시 마을로 이동

## 최종 이미지 제작 프롬프트

Use case: illustration-story. Asset: temporary 4-panel intro webtoon storyboard art for cozy fantasy game MOKDO. Create ONE landscape image 1536x1024, divided into EXACTLY four equal rectangular panels in a precise 2 by 2 grid, no gutters, no outer frame. Each quadrant is a separate complete illustration, exact same size, intended to be cropped into four 3:2 panels by CSS. Reading order top left, top right, bottom left, bottom right. Consistent protagonist in every panel: a simple friendly black stick figure with an empty round cream-colored head, thick bold round black line limbs and body, no clothing, no realistic human features, matching a temporary thick-line stickman placeholder. Story: TOP LEFT the stick figure wakes sitting under a huge old tree in a quiet sunny grassy meadow as a tiny glowing green seed floats near its head. TOP RIGHT the stick figure walks along a winding forest path following that same floating green seed, curious and hopeful. BOTTOM LEFT the stick figure crosses a rustic wooden footbridge over a sparkling turquoise stream, a whimsical green valley in the distance. BOTTOM RIGHT the stick figure seen from behind arrives at the entrance to a welcoming tiny fantasy village with warm terracotta-roof cottages, flowers and an enormous leafy tree, the seed glows ahead. Hand-painted storybook webtoon aesthetic, visible soft brush textures, expressive camera compositions, fresh emerald greens, cream paper tones, warm sunlight and blue skies. Keep the protagonist unmistakably identical across panels. Absolutely no text, no letters, no captions, no speech bubbles, no logos, no watermark, no UI. The image must be four separate clean illustrations aligned to exact quadrant boundaries.
