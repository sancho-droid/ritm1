import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as TimeEngine from './time-engine.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
assert.match(html, /import \* as TimeEngine from '\.\/time-engine\.js\?v=20261123-4'/);
assert.match(serviceWorker, /'\.\/time-engine\.js\?v=20261123-4'/, 'service worker precaches the versioned module URL used by the app');
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
assert.match(html, /\.current-time-bead\{position:absolute/);
assert.match(html, /TimeEngine\.timeScalePosition\(anchors,minute\)/, 'bead position follows actual schedule anchors');
assert.match(html, /if\(!list\.querySelector\('\.task'\)\)\{bead\.style\.display='none'/, 'bead stays hidden when the timed schedule is empty');
assert.match(html, /item\.classList\.contains\('task'\)&&item\._task/);
assert.match(html, /item\.dataset\.startMinute/);
assert.match(html, /const card=item\.querySelector\('\.taskbody'\)\|\|item/);
assert.match(html, /TimeEngine\.timeScaleTaskAnchors\(display,duration,cardRect\.top-rootRect\.top,cardRect\.bottom-rootRect\.top\)/, 'task anchors use the visible bordered card, not the outer task row');
assert.match(html, /new ResizeObserver\(updateCurrentTimeBead\)/, 'bead recalculates after card or boundary geometry changes');
assert.match(html, /setInterval\(\(\)=>\{updateCurrentTimeBead\(\)/, 'bead follows the live clock');
assert.match(html, /position===null\)\{bead\.style\.display='none'/, 'bead hides outside available schedule anchors and on other dates');
assert.match(html, /bead\.style\.top=position\+'px'/, 'bead overlays the interpolated schedule position without changing card layout');
assert.match(html, /const initialPosition=bead\.dataset\.positioned!==\'true\';if\(initialPosition\)bead\.style\.transition=\'none\';bead\.style\.top=position\+'px';bead\.style\.display=\'flex\';if\(initialPosition\)\{bead\.getBoundingClientRect\(\);bead\.style\.removeProperty\(\'transition\'\);bead\.dataset\.positioned=\'true\'\}/, 'first measured position is applied without animation; transitions are enabled only for later clock updates');
console.log('left time rail UI integration: assertions passed');

const desktopRailRule = html.indexOf('.timed-schedule-list .task{grid-template-columns:52px');
const mobileRailRule = html.indexOf('.timed-schedule-list .task{grid-template-columns:43px');
const legacyMobileGrid = html.indexOf('.schedule-list .task,.unscheduled-list .schedule-task{grid-template-columns:minmax(0,1fr) auto');
assert.ok(desktopRailRule > 0 && desktopRailRule > legacyMobileGrid, 'rail grid overrides legacy mobile grid');
assert.ok(mobileRailRule > legacyMobileGrid, 'mobile rail grid overrides legacy mobile grid');

assert.match(html, /TimeEngine\.timeScaleTaskAnchors\(display,duration,cardRect\.top-rootRect\.top,cardRect\.bottom-rootRect\.top\)/,
  'bead uses each visible bordered card top and bottom as its interval anchors');
assert.match(html, /now\.getSeconds\(\)\/60/,
  'bead interpolates continuously between minute ticks');
assert.match(html, /},1000\);/,
  'bead geometry refreshes every second');
assert.match(html, /\.current-time-bead\{position:absolute;z-index:7;left:0;top:0;[^}]*transform:translate\(-50%,-50%\)[^}]*transition:top \.9s linear/,
  'bead uses measured horizontal position and smooth vertical transition');
assert.match(html, /\.current-time-bead\{position:absolute;z-index:7;left:0;top:0;/,
  'bead horizontal position is measured from the real grid track rather than hardcoded');
assert.match(html, /const railColon=railRange\.getBoundingClientRect\(\)/,
  'bead alignment measures the actual colon glyph in the task time rail');
assert.match(html, /const beadColonOffset=\(beadColon\.left\+beadColon\.right\)\/2-\(beadRect\.left\+beadRect\.right\)\/2/,
  'bead alignment compensates for its own colon glyph offset');
assert.match(html, /bead\.style\.left=\(targetColon-beadColonOffset-rootRect\.left\)\+'px'/,
  'the two colon glyph centers share the same vertical axis');
assert.match(html, /@media\(max-width:600px\)\{\.current-time-bead\{width:41px;/,
  'mobile bead is centered on the 43px time rail');
console.log('proportional bead geometry and centered rail integration: assertions passed');

const firstTaskAnchors = TimeEngine.timeScaleTaskAnchors(12 * 60, 30, 100, 200);
const nextTaskAnchors = TimeEngine.timeScaleTaskAnchors(12 * 60 + 30, 30, 212, 312);
const sharedBoundary = TimeEngine.timeScalePosition([...firstTaskAnchors, ...nextTaskAnchors], 12 * 60 + 30);
assert.equal(sharedBoundary, 200, 'at a shared timestamp the bead axis lands on the previous card bottom border');
assert.equal(TimeEngine.timeScalePosition([...firstTaskAnchors, ...nextTaskAnchors], 12 * 60), 100,
  'task start aligns with the top border of the card');
assert.equal(TimeEngine.timeScalePosition([...firstTaskAnchors, ...nextTaskAnchors], 12 * 60 + 15), 150,
  'during the task the bead axis interpolates inside the card');
assert.ok(TimeEngine.timeScalePosition([...firstTaskAnchors, ...nextTaskAnchors], 12 * 60 + 30 + 0.001) > 212,
  'after the shared boundary the bead continues from the next card top, preserving the visible inter-card gap');
assert.equal(TimeEngine.timeScalePosition([...firstTaskAnchors, ...nextTaskAnchors], 12 * 60 + 45), 262,
  'the next task is interpolated from its own top edge to its bottom edge');
console.log('shared task-boundary geometry: assertions passed');
