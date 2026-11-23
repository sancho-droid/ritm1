import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
assert.match(html, /\.timed-schedule-list \.task\{grid-template-columns:52px minmax\(0,1fr\) auto\}/);
assert.match(html, /\.timed-schedule-list \.taskbody\{grid-column:2\}/);
assert.match(html, /\.timed-schedule-list \.tasktools\{grid-column:3\}/);
assert.match(html, /\.timed-schedule-list \.task-time-rail\{[^}]*align-self:center/);
assert.match(html, /@media\(max-width:600px\)\{\.timed-schedule-list \.task\{grid-template-columns:43px minmax\(0,1fr\) auto\}\}/);
assert.match(html, /\.timed-schedule-list \.task-time-range\{display:none\}/);
assert.match(html, /rail\.className='task-time-rail'/);
assert.match(html, /TimeEngine\.timelineTimeForTask\(t,new Date\(\)\)/);
assert.match(html, /TimeEngine\.timeScaleBounds\(timed,new Date\(\)\)/);
assert.match(html, /dayStartBoundary\.dataset\.minute=timeScale\?String\(timeScale\.start\):''/);
assert.match(html, /dayEndBoundary\.dataset\.minute=timeScale\?String\(timeScale\.end\):''/);
assert.match(html, /completionKind:r\?\.completionKind\?\?t\.completionKind/);
assert.match(html, /completionKind:r\.completionKind\?\?t\.completionKind/);
console.log('left time rail UI integration: assertions passed');
