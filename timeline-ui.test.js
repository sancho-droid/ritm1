import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as TimeEngine from './time-engine.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
assert.match(html, /import \* as TimeEngine from '\.\/time-engine\.js\?v=20261123-5'/);
assert.match(serviceWorker, /'\.\/time-engine\.js\?v=20261123-5'/, 'service worker precaches the versioned module URL used by the app');
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
assert.doesNotMatch(html,/class="drag-handle"/, 'task cards no longer show a separate drag button');
assert.match(html,/dragSurface\.addEventListener\('pointerdown'/, 'the full task card is the drag surface');
assert.match(html,/\.schedule-list \.taskbody\{touch-action:none;cursor:grab\}/, 'the full card surface supports pointer drag on touch devices');
assert.match(html,/e\.target\.closest\('button,input,select,textarea,a,\[data-no-drag\]'\)/, 'task actions remain interactive and do not start a drag');
assert.doesNotMatch(html,/\.task\.drag-source\{[^}]*outline:1px dashed/, 'the old card position has no dashed outline');
assert.match(html,/else if\(list\)render\(\);/, 'an abandoned unscheduled reorder restores the original rendered order');
assert.match(html,/if\(list\)render\(\);\s*\}\);/, 'pointer cancellation restores an unscheduled list after live DOM reordering');
assert.match(html,/function dragTimeScaleAnchors\(state,list\)/, 'drag anchors use measured task and free-gap geometry');
assert.doesNotMatch(html,/if\(!task\|\|task\.done\|\|task\.isFamily\|\|!task\.time\)/, 'completed, family and dragged task cards remain part of the visual time geometry');
assert.match(html,/TimeEngine\.timelineTimeForTask\(task,now\)\?\?task\.time/, 'drag anchors use the same displayed time as the current-time bead');
assert.match(html,/if\(!task\.done\)\{\s*const raw=Number\(task\.duration\)/, 'completed cards use point anchors rather than blocking their original duration');
assert.match(html,/const topY=e\.clientY-state\.grabOffsetY,centerY=topY\+state\.ghostHeight\/2/, 'drag time is measured from the dragged card center');
assert.match(html,/if\(state\.source\.closest\('\.unscheduled-list'\)\)\{\s*const reference=\$\('#scheduledTasks \.timed-schedule-list \.taskbody'\)/, 'undated drag ghost aligns horizontally with timed cards, leaving the time rail unobstructed');
assert.match(html,/TimeEngine\.timeScaleMinuteAtPosition\(anchors,centerY\)/, 'drag converts the card center back to timeline minutes');
assert.doesNotMatch(html,/TimeEngine\.timeScaleMinuteAtPosition\(anchors,topY\)/, 'drag no longer maps the card top edge to a time');
assert.match(html,/marker\.style\.top=\(centerY-rootRect\.top\)\+'px'/, 'the displayed time bead and its time calculation share the same center coordinate');
assert.match(html,/Math\.round\(minute\/5\)\*5/, 'drag preview snaps to five-minute increments');
assert.match(html,/TimeEngine\.timeScalePosition\(anchors,snapped\)/, 'preview bead is positioned at the snapped five-minute mark');
assert.doesNotMatch(html,/Math\.round\(minute\)\)/, 'drag preview no longer uses one-minute precision');
assert.match(html,/marker\.textContent=state\.task\.time\|\|'—'/, 'undated tasks receive a visible preview bead when entering the timeline');
assert.match(html,/if\(!t\.isFamily&&!\(t\.time&&t\.done\)\)dragSurface\.addEventListener/, 'family and completed timed cards are not draggable');
assert.match(html,/const root=\$\('#scheduledTasks'\),list=root\?\.querySelector\('\.timed-schedule-list'\),bead=root\?\.querySelector\('\.current-time-bead'\)/, 'all task drags create a timeline preview target');
assert.match(html,/if\(state\.previewTime\)\{moveDraggedTaskToTime\(state\.task,state\.previewTime\);\}/, 'dropping a dated or undated card on the schedule commits its assigned time');
assert.match(html,/state\.reorder=e\.clientX>=rect\.left&&e\.clientX<=rect\.right&&e\.clientY>=rect\.top&&e\.clientY<=rect\.bottom/, 'undated cards distinguish list sorting from dropping into the schedule');
assert.match(html,/if\(state\.reorder\)\{[\s\S]*?return;\s*\}\s*\}\s*state\.reorder=false;updateTimedDragPreview\(state,e\)/, 'leaving the unscheduled list switches from sorting to timeline placement');
assert.match(html,/if\(state\.reorder&&list\)\{/, 'sorting within the unscheduled list remains supported');
assert.match(html,/function moveDraggedTaskToTime\(task,time,\{allowOverlap=false\}=\{\}\)/, 'successful drag has a dedicated persistence path with explicit overlap choice');
assert.match(html,/conflicts=findTaskConflicts\(task,date,time\)/, 'drag gathers every overlapping blocking task before committing');
assert.match(html,/function showDragConflict\(task,date,time,conflicts\)/, 'drag opens a conflict decision dialog');
assert.match(html,/id="dragConflictCombine"/, 'user can explicitly combine overlapping tasks');
assert.match(html,/id="dragConflictChange"/, 'user can choose a different time after a conflict');
assert.match(html,/id="dragConflictCancel"/, 'user can cancel and restore the original task placement');
assert.match(html,/function openDragTimeEditor\(\)/, 'change-time action opens a dedicated time editor');
assert.match(html,/findTaskConflicts\(task,date,time\);if\(conflicts.length\)/, 'a second conflict after changing time requires another decision');
assert.match(html,/moveDraggedTaskToTime\(pendingDragMove.task,pendingDragMove.time,\{allowOverlap:true\}\)/, 'combine explicitly commits an overlapping placement');
assert.match(html,/if\(other\.done\|\|sameTaskOccurrence\(candidate,other\)\|\|other\?\.scheduleMode==='parallel'\)continue;/, 'completed tasks do not block a time slot after they release it');

const dragPreviewAnchors = [{ minute: 13 * 60, y: 100 }, { minute: 14 * 60, y: 200 }];
const draggedCardCenter = 115;
const mappedDragMinute = TimeEngine.timeScaleMinuteAtPosition(dragPreviewAnchors, draggedCardCenter);
assert.equal(TimeEngine.formatClock(Math.round(mappedDragMinute)), '13:09',
  'a card centered over 13:09 previews 13:09, not the time at its top edge');
assert.equal(TimeEngine.formatClock(Math.round(TimeEngine.timeScaleMinuteAtPosition(dragPreviewAnchors, 100))), '13:00',
  'regression fixture demonstrates why using the card top edge produced an earlier time');

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
