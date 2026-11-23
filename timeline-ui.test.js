import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as TimeEngine from './time-engine.js';

// Hidden one-second start offset applies only to calculations, never to stored/displayed clock strings.
const adjacentFirst = { id: 'first', time: '12:00', duration: 60 };
const adjacentSecond = { id: 'second', time: '13:00', duration: 120 };
const firstInterval = TimeEngine.conflictInterval(adjacentFirst);
const secondInterval = TimeEngine.conflictInterval(adjacentSecond);
assert.equal(firstInterval.start, 12 * 60 + 1 / 60, 'every task start is shifted by exactly one second in conflict calculations');
assert.equal(firstInterval.end, 13 * 60, 'the first task keeps its original calculated end');
assert.equal(secondInterval.start, 13 * 60 + 1 / 60, 'the next task starts one calculation-second after the shared displayed minute');
assert.equal(secondInterval.end, 15 * 60, 'the next task keeps its original calculated end');
assert.equal(firstInterval.start < secondInterval.end && secondInterval.start < firstInterval.end, false,
  'tasks ending and starting at the same displayed minute do not conflict');
const sameStartFirst = TimeEngine.conflictInterval({ id: 'same-a', time: '12:00', duration: 60 });
const sameStartSecond = TimeEngine.conflictInterval({ id: 'same-b', time: '12:00', duration: 60 });
assert.equal(sameStartFirst.start < sameStartSecond.end && sameStartSecond.start < sameStartFirst.end, true,
  'two tasks assigned the same start time still conflict');
assert.equal(adjacentFirst.time, '12:00', 'the stored/displayed start string remains unchanged');
assert.equal(adjacentSecond.time, '13:00', 'the stored/displayed start string remains unchanged for the adjacent task');
assert.equal(TimeEngine.conflictInterval({ time: '', duration: 30 }), null, 'tasks without a start time do not create a timed conflict interval');
assert.equal(TimeEngine.conflictInterval({ time: '23:59', duration: 2 }).end, 24 * 60 + 1,
  'an interval crossing midnight retains its original end boundary');
console.log('hidden one-second conflict interval: assertions passed');

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
assert.match(html, /import \* as TimeEngine from '\.\/time-engine\.js\?v=20261123-7'/);
assert.match(serviceWorker, /'\.\/time-engine\.js\?v=20261123-7'/, 'service worker precaches the versioned module URL used by the app');
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
assert.match(html,/function dragTimeScaleAnchors\(state,list\)/, 'drag uses one fixed full-day ruler rather than card-derived anchors');
assert.match(html,/return \[\{minute:0,y:state\.dragScaleTop\},\{minute:1439,y:state\.dragScaleBottom\}\]/, 'the drag ruler always maps 00:00 to 23:59 across the captured available height');
assert.match(html,/state\.dragScaleTop=\(startRect\?\.top\?\?listRect\?\.top\?\?NaN\)\+window\.scrollY/, 'the upper boundary is captured once when drag starts');
assert.match(html,/state\.dragScaleBottom=\(endRect\?\.top\?\?listRect\?\.bottom\?\?NaN\)\+window\.scrollY/, 'the lower boundary is captured once when drag starts');
assert.doesNotMatch(html.slice(html.indexOf('function dragTimeScaleAnchors'),html.indexOf('function startTaskDrag')), /getBoundingClientRect|_task|timeScaleTaskAnchors/, 'card geometry and task durations cannot resize or bend the drag ruler');
assert.match(html,/const topY=e\.clientY-state\.grabOffsetY,centerY=topY\+state\.ghostHeight\/2/, 'drag time is measured from the dragged card center');
assert.match(html,/if\(state\.source\.closest\('\.unscheduled-list'\)\)\{\s*const reference=\$\('#scheduledTasks \.timed-schedule-list \.taskbody'\)/, 'undated drag ghost aligns horizontally with timed cards, leaving the time rail unobstructed');
assert.match(html,/state\.ghostLeft=referenceRect\.left;state\.ghostWidth=referenceRect\.width;/, 'undated drag ghost uses the same horizontal left edge and width as scheduled task cards');
assert.match(html,/ghost\.style\.height=state\.ghostHeight\+'px'/, 'undated drag ghost preserves the original card height');
assert.match(html,/TimeEngine\.timeScaleMinuteAtPosition\(anchors,centerDocumentY\)/, 'drag converts the card center against the fixed document-space ruler');
assert.ok(html.includes('centerDocumentY=centerY+window.scrollY'), 'scrolling does not move the ruler relative to the page content');
assert.match(html,/const minY=anchors\[0\]\.y,maxY=anchors\[1\]\.y/, 'drag range is bounded by the fixed top and bottom edges');
assert.match(html,/const markerY=centerY/, 'drag preview bead stays attached to the dragged card center across every crossed card');
assert.doesNotMatch(html,/taskDuration===0&&centerY>=cardRect\.top&&centerY<=cardRect\.bottom/, 'crossed cards cannot take control of the preview bead position');
assert.match(html,/marker\.style\.transition='none'/, 'drag preview bead has no easing delay and remains attached to the dragged card');
assert.doesNotMatch(html,/TimeEngine\.timeScaleMinuteAtPosition\(anchors,topY\)/, 'drag no longer maps the card top edge to a time');
assert.match(html,/marker\.style\.top=\(markerY-rootRect\.top\)\+'px'/, 'drag bead follows the dragged card center without switching to a crossed card boundary');
assert.match(html,/Math\.round\(minute\/5\)\*5/, 'drag preview snaps to five-minute increments');
assert.doesNotMatch(html,/TimeEngine\.timeScalePosition\(anchors,snapped\)/, 'preview time snapping does not reposition the bead away from the dragged card');
assert.match(html,/function dragItemRect\(item\)/, 'drag geometry can ignore temporary visual transforms');
assert.match(html,/while\(node&&node!==list\)/, 'drag geometry removes transforms from the full ancestor chain');
assert.match(html,/function updateDragDisplacement\(state,e\)/, 'neighboring schedule cards receive temporary visual displacement');
assert.match(html,/item\.style\.transform='translateY\('\+shift\+'px\)'/, 'neighboring cards move visually without changing their layout data');
assert.match(html,/item\.style\.removeProperty\('transform'\)/, 'temporary visual displacement can be removed');
assert.match(html,/state\.reorder=false;updateDragDisplacement\(state,e\);updateTimedDragPreview\(state,e\)/, 'schedule displacement updates during pointer movement');
assert.match(html,/clearTimeout\(state\.timer\);clearDragDisplacement\(\);state\.ghost\?\.remove\(\)/, 'all displaced cards return to their original visual positions when dragging ends');
assert.match(html,/now\.getSeconds\(\)\/60/, 'live current-time bead retains second-level precision independently of drag snapping');
assert.doesNotMatch(html,/Math\.round\(minute\)\)/, 'drag preview no longer uses one-minute precision');
assert.match(html,/marker\.textContent=state\.task\.time\|\|'00:00'/, 'undated tasks start with a measurable clock-shaped bead so its colon can align to the live time axis');
assert.match(html,/function commitDraggedTaskWithoutTime\(task\)/, 'timed tasks have a dedicated path back to the undated list');
assert.match(html,/original\.time='';original\.endTime=''/, 'returning a task to the undated list clears its start and end while retaining its duration');
assert.match(html,/state\.dropToUnscheduled=true/, 'dragging a timed task over the undated list activates the return drop target');
assert.match(html,/if\(state\.dropToUnscheduled\)\{moveDraggedTaskToUnscheduled\(state\.task\);\}/, 'dropping a timed task in the undated list clears its scheduled time');
assert.match(html,/className='unscheduled-list unscheduled-drop-zone'/, 'an empty undated list receives a temporary visible drop target during drag');
assert.match(html,/if\(!t\.isFamily&&!\(t\.time&&t\.done\)\)dragSurface\.addEventListener/, 'family and completed timed cards are not draggable');
assert.match(html,/const root=\$\('#scheduledTasks'\),list=root\?\.querySelector\('\.timed-schedule-list'\),bead=root\?\.querySelector\('\.current-time-bead'\)/, 'all task drags create a timeline preview target');
assert.match(html,/if\(state\.previewTime\)\{moveDraggedTaskToTime\(state\.task,state\.previewTime\);\}/, 'dropping a dated or undated card on the schedule commits its assigned time');
assert.match(html,/state\.reorder=e\.clientX>=rect\.left&&e\.clientX<=rect\.right&&e\.clientY>=rect\.top&&e\.clientY<=rect\.bottom/, 'undated cards distinguish list sorting from dropping into the schedule');
assert.match(html,/if\(state\.reorder\)\{[\s\S]*?return;\s*\}\s*\}\s*state\.reorder=false;updateDragDisplacement\(state,e\);updateTimedDragPreview\(state,e\)/, 'leaving the unscheduled list switches from sorting to timeline placement and visual slot preview');
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

const pointTaskDragAnchors = [
  { minute: 11 * 60 + 45, y: 100 }, { minute: 11 * 60 + 45, y: 150 },
  { minute: 11 * 60 + 50, y: 162 }, { minute: 11 * 60 + 50, y: 212 }
];
for (const y of [100, 112, 125, 149, 150]) {
  assert.equal(TimeEngine.formatClock(TimeEngine.timeScaleMinuteAtPosition(pointTaskDragAnchors, y)), '11:45',
    'the entire first durationless task card retains 11:45 during drag');
}
for (const y of [162, 175, 190, 211, 212]) {
  assert.equal(TimeEngine.formatClock(TimeEngine.timeScaleMinuteAtPosition(pointTaskDragAnchors, y)), '11:50',
    'the entire next durationless task card switches cleanly to 11:50');
}
assert.ok(TimeEngine.timeScaleMinuteAtPosition(pointTaskDragAnchors, 156) > 11 * 60 + 45,
  'only the visual gap between durationless cards interpolates between their times');
console.log('durationless drag-card time lock: assertions passed');
const fixedDayRuler = [{ minute: 0, y: 100 }, { minute: 1439, y: 1100 }];
assert.equal(TimeEngine.timeScaleMinuteAtPosition(fixedDayRuler, 100), 0,
  'the top edge of the available timeline always represents midnight');
assert.equal(TimeEngine.timeScaleMinuteAtPosition(fixedDayRuler, 600), 719.5,
  'the ruler distributes all 1,439 minute steps uniformly through the available height');
assert.equal(TimeEngine.timeScaleMinuteAtPosition(fixedDayRuler, 1100), 1439,
  'the bottom edge of the available timeline always represents 23:59');
assert.equal(TimeEngine.formatClock(Math.max(0, Math.min(1435, Math.round(TimeEngine.timeScaleMinuteAtPosition(fixedDayRuler, 1100) / 5) * 5))), '23:55',
  'the final five-minute snap remains inside the 23:59 day boundary');
console.log('fixed full-day drag ruler: assertions passed');

