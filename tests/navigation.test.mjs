import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { nearLandmark, TOWN_PORTAL, FIELD_RETURN, CAVE_ENTRANCE, FIELD_CAVE_SPAWN, FIELD_TOWN_SPAWN } = await loadTS('../src/game/navigation.ts');

test('portals and cave require approaching the actual entrance', () => {
    for (const landmark of [TOWN_PORTAL, FIELD_RETURN, CAVE_ENTRANCE]) {
        assert.equal(nearLandmark(landmark, landmark), true);
        assert.equal(nearLandmark({ x: landmark.x + landmark.radius, y: landmark.y }, landmark), true);
        assert.equal(nearLandmark({ x: landmark.x + landmark.radius + 1, y: landmark.y }, landmark), false);
    }
});

test('field entry avoids the town portal; cave return remains inside interaction range', () => {
    assert.equal(nearLandmark(FIELD_TOWN_SPAWN, FIELD_RETURN), false);
    assert.equal(nearLandmark(FIELD_TOWN_SPAWN, CAVE_ENTRANCE), false);
    assert.equal(nearLandmark(FIELD_CAVE_SPAWN, CAVE_ENTRANCE), true);
});
