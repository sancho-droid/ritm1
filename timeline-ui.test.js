import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
assert.match(html, /\.timed-schedule-list \.task\{grid-template-columns:52px minmax\(0,1fr\) auto\}/);
assert.match(html, /\.timed-schedule-list \.taskbody\{grid-column:2\}/);
assert.match(html, /\.timed-schedule-list \.tasktools\{grid-column:3\}/);
assert.match(html, /\.timed-schedule-list \.task-time-rail\{[^}]*align-self:center/);
assert.match(html, /@media\(max-width:600px\)\{\.timed-schedule-list \.task\{grid-template-columns:43px minmax\(0,1fr\) auto\}\}/);
assert.doesNotMatch(html, /\.timed-schedule-list \.task-time-range\{display:none\}/, 'planned time range remains visible inside task cards');
assert.match(html, /justify-self:start;align-self:center[^}]*text-align:left/, 'left rail labels align to the same content edge as section headings');
assert.match(html, /range\.className='task-time-range'/, 'task card still renders its planned time range');
assert.match(html, /range\.textContent=end&&end!==t\.time\?t\.time\+' – '\+end:t\.time/, 'task card shows start and end for timed tasks with a range');
assert.match(html, /rail\.className='task-time-rail'/);
assert.match(html, /TimeEngine\.timelineTimeForTask\(t,new Date\(\)\)/);
assert.match(html, /TimeEngine\.timeScaleBounds\(timed,new Date\(\)\)/);
assert.match(html, /dayStartBoundary\.dataset\.minute=timeScale\?String\(timeScale\.start\):''/);
assert.match(html, /dayEndBoundary\.dataset\.minute=timeScale\?String\(timeScale\.end\):''/);
assert.match(html, /completionKind:r\?\.completionKind\?\?t\.completionKind/);
assert.match(html, /completionKind:r\.completionKind\?\?t\.completionKind/);
console.log('left time rail UI integration: assertions passed');

const desktopRailRule = html.indexOf('.timed-schedule-list .task{grid-template-columns:52px');
const mobileRailRule = html.indexOf('.timed-schedule-list .task{grid-template-columns:43px');
const legacyMobileGrid = html.indexOf('.schedule-list .task,.unscheduled-list .schedule-task{grid-template-columns:minmax(0,1fr) auto');
assert.ok(desktopRailRule > 0 && desktopRailRule > legacyMobileGrid, 'rail grid overrides legacy mobile grid');
assert.ok(mobileRailRule > legacyMobileGrid, 'mobile rail grid overrides legacy mobile grid');
