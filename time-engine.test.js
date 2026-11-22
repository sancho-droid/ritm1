import assert from 'node:assert/strict';
import {DAY_START_MINUTES,DAY_END_MINUTES,parseClock,formatClock,durationOf,sortChronologically,intervalsFor,freeIntervals,findNextFreeGap,freeTimeAnchorIndex,conflicts,orderTimedTasksForDisplay,inferDayBoundaryRole,assignDayBoundaryRoles,dayBoundaryIssue,dayBoundsForTasks,} from './time-engine.js';
assert.equal(parseClock('00:00'),0);assert.equal(parseClock('19:09'),1149);assert.equal(parseClock('23:59'),1439);assert.equal(parseClock('24:00'),null);assert.equal(parseClock('9:00'),null);assert.equal(parseClock('bad'),null);assert.equal(formatClock(1149),'19:09');assert.equal(formatClock(1440),'23:59');
assert.deepEqual(sortChronologically([{id:'a',time:'20:15'},{id:'b',time:'17:20'},{id:'c',time:'19:00'},{id:'d',time:''}]).map(x=>x.time),['17:20','19:00','20:15','']);assert.deepEqual(sortChronologically([{id:'z',time:'09:00'},{id:'a',time:'09:00'}]).map(x=>x.id),['z','a']);
assert.equal(durationOf({time:'23:30',endTime:'00:15'}),45);assert.deepEqual(intervalsFor([{time:'17:20',duration:30},{time:'17:45',duration:30},{time:'18:15',duration:15,done:true},{time:'19:00',duration:20}]).map(x=>[x.start,x.end]),[[1040,1095],[1140,1160]]);
assert.deepEqual(freeIntervals([{time:'17:20',duration:40},{time:'19:00',duration:20}],{nowMinutes:1080,dayEnd:1380,minGap:15}).map(x=>[x.start,x.end]),[[1080,1140],[1160,1380]]);assert.deepEqual(intervalsFor([{time:'20:15',duration:30},{time:'17:20',duration:25},{time:'19:00',duration:40},{time:'19:20',duration:20}]).map(x=>[x.start,x.end]),[[1040,1065],[1140,1180],[1215,1245]]);
assert.equal(conflicts({time:'18:00',duration:60},[{id:'x',time:'18:30',duration:20}]).length,1);assert.equal(conflicts({time:'18:00',duration:30},[{id:'x',time:'18:30',duration:20}]).length,0);
console.log('time-engine: assertions passed');

// Parallel tasks are visible, but do not occupy free time or create conflicts.
assert.deepEqual(intervalsFor([{time:'14:00',duration:180,scheduleMode:'parallel'},{time:'14:00',duration:180}]).map(x=>[x.start,x.end]),[[840,1020]]);
assert.deepEqual(freeIntervals([{time:'14:00',duration:180,scheduleMode:'parallel'}],{nowMinutes:780,dayEnd:1080,minGap:15}).map(x=>[x.start,x.end]),[[780,1080]]);
assert.equal(conflicts({time:'14:00',duration:60,scheduleMode:'parallel'},[{time:'14:30',duration:30}]).length,0);
assert.equal(conflicts({time:'14:00',duration:60},[{time:'14:30',duration:30,scheduleMode:'parallel'}]).length,0);
// Family event duration is inferred from start/end, including midnight crossing.
assert.equal(durationOf({time:'14:00',endTime:'17:00',duration:0}),180);
assert.equal(durationOf({time:'23:00',endTime:'01:00',duration:0}),120);
console.log('parallel tasks and family intervals: assertions passed');

// Family events with an end time occupy the full interval in free-time and conflict calculations.
assert.deepEqual(freeIntervals([{time:'14:00',endTime:'17:00',duration:0,isFamily:true}],{nowMinutes:780,dayEnd:1080,minGap:15}).map(x=>[x.start,x.end]),[[780,840],[1020,1080]]);
assert.equal(conflicts({id:'candidate',time:'16:30',duration:30},[{id:'family',time:'14:00',endTime:'17:00',duration:0,isFamily:true}]).length,1);
console.log('family interval conflict/free-time: assertions passed');



// Early-completed scheduled tasks move after the latest task whose time has arrived,
// retain chronological order among themselves, and return to chronology at their slot.
const orderDate='2026-11-22';
const scheduledTasks=[
  {id:'wake',time:'06:00',done:true,doneAt:'2026-11-22T00:05:00'},
  {id:'shower',time:'06:15',done:true,doneAt:'2026-11-22T00:20:00'},
  {id:'work',time:'08:00',done:true,doneAt:'2026-11-22T01:00:00'},
  {id:'reading',time:'10:00',done:false},
  {id:'shop',time:'12:00',done:true,doneAt:'2026-11-22T04:00:00'},
  {id:'call',time:'15:00',done:true,doneAt:'2026-11-22T04:00:00'},
];
assert.deepEqual(
  orderTimedTasksForDisplay(scheduledTasks,orderDate,new Date(2026,10,22,11,0)).map(x=>x.id),
  ['wake','shower','work','reading','shop','call']
);
assert.deepEqual(
  orderTimedTasksForDisplay(scheduledTasks,orderDate,new Date(2026,10,22,16,0)).map(x=>x.id),
  ['wake','shower','work','reading','shop','call']
);
// Early completions move ahead of later future tasks, preserving their own time order.
const withLaterFuture=[...scheduledTasks,{id:'later-future',time:'18:00',done:false}];
assert.deepEqual(
  orderTimedTasksForDisplay(withLaterFuture,orderDate,new Date(2026,10,22,11,0)).map(x=>x.id),
  ['wake','shower','work','reading','shop','call','later-future']
);
// An uncompleted task whose time has passed remains before early-completed future tasks.
const withOverdue=[...scheduledTasks,{id:'earlier-unfinished',time:'09:00',done:false}];
assert.deepEqual(
  orderTimedTasksForDisplay(withOverdue,orderDate,new Date(2026,10,22,11,0)).map(x=>x.id),
  ['wake','shower','work','earlier-unfinished','reading','shop','call']
);
// At the scheduled minute, an early completion stops being temporarily promoted.
assert.deepEqual(
  orderTimedTasksForDisplay(scheduledTasks,orderDate,new Date(2026,10,22,12,0)).map(x=>x.id),
  ['wake','shower','work','reading','shop','call']
);
console.log('early-completion display ordering: assertions passed');


// The day calculation boundaries are 00:00 and 23:59; they are internal coordinates.
assert.equal(DAY_START_MINUTES,0);
assert.equal(DAY_END_MINUTES,1439);


// A short gap immediately after now must not hide the next useful free interval.
const afterNowTasks=[
  {id:'soon',time:'20:00',duration:1,_freeTimeIndex:4},
  {id:'later',time:'21:15',duration:30,_freeTimeIndex:5},
];
const afterNowOccupied=intervalsFor(afterNowTasks,{includeCompleted:true,dayEnd:DAY_END_MINUTES});
assert.deepEqual(
  findNextFreeGap(afterNowOccupied,19*60+51,3,{dayEnd:DAY_END_MINUTES,minGap:15}),
  {start:20*60+1,end:21*60+15,duration:74,afterIndex:4}
);
// A currently running task moves the start of the free interval to its end.
const running=intervalsFor([{id:'running',time:'19:30',duration:30,_freeTimeIndex:2},{id:'next',time:'21:00',duration:15,_freeTimeIndex:3}],{includeCompleted:true});
assert.deepEqual(findNextFreeGap(running,19*60+45,2),{start:20*60,end:21*60,duration:60,afterIndex:2});
// If all remaining gaps are shorter than the threshold, no counter is shown.
const shortOnly=intervalsFor([{time:'20:00',duration:10,_freeTimeIndex:4}],{includeCompleted:true});
assert.equal(findNextFreeGap(shortOnly,19*60+55,3,{dayEnd:20*60+10}),null);
console.log('current free-time gap selection: assertions passed');


// Early-completed future tasks are also behind the free-time marker.
const screenshotTasks=[
  {time:'19:35',done:true,doneAt:'2026-11-22T19:36:00'},
  {time:'19:50',done:true,doneAt:'2026-11-22T19:40:00'},
  {time:'20:00',done:true,doneAt:'2026-11-22T19:45:00'},
  {time:'21:15',done:false},
];
assert.equal(freeTimeAnchorIndex(screenshotTasks,'2026-11-22',19*60+49),2);
assert.equal(freeTimeAnchorIndex([{time:'19:50',done:true,doneAt:'2026-11-22T19:40:00'},{time:'20:00',done:false}], '2026-11-22',19*60+51),0);
console.log('free-time placement after completed tasks: assertions passed');

 
// Day boundaries are assigned once from exact names and then survive task renaming.
assert.equal(inferDayBoundaryRole('Подъём'),'start');
assert.equal(inferDayBoundaryRole('ПОДЪЕМ'),'start');
assert.equal(inferDayBoundaryRole('Проснуться'),'start');
assert.equal(inferDayBoundaryRole('Встать'),'start');
assert.equal(inferDayBoundaryRole('Сон'),'end');
assert.equal(inferDayBoundaryRole('Лечь спать'),'end');
assert.equal(inferDayBoundaryRole('Отбой'),'end');
assert.equal(inferDayBoundaryRole('Подъём дочери'),null);
const boundaryTasks=[{id:'wake',name:'Подъём',time:'06:00',duration:15},{id:'sleep',name:'Сон',time:'23:00',duration:480}];
assignDayBoundaryRoles(boundaryTasks);
assert.equal(boundaryTasks[0].dayBoundary,'start');
assert.equal(boundaryTasks[1].dayBoundary,'end');
assert.deepEqual(dayBoundsForTasks(boundaryTasks),{start:375,end:1380});
boundaryTasks[0].name='Начало дня';
assignDayBoundaryRoles(boundaryTasks);
assert.equal(boundaryTasks[0].dayBoundary,'start');
assert.deepEqual(dayBoundsForTasks(boundaryTasks),{start:375,end:1380});
const ambiguous=[{name:'Подъём',time:'06:00'},{name:'Проснуться',time:'06:15'},{name:'Сон',time:'23:00'}];
assignDayBoundaryRoles(ambiguous);
assert.equal(ambiguous[0].dayBoundary,undefined);
assert.equal(ambiguous[1].dayBoundary,undefined);
assert.match(dayBoundaryIssue(ambiguous),/несколько кандидатов на начало дня/);
assert.equal(dayBoundsForTasks(ambiguous),null);
const oneBoundary=[{name:'Подъём',time:'06:00',duration:10,dayBoundary:'start'},{name:'Завтрак',time:'08:00',duration:30},{name:'Чтение',time:'21:00',duration:30}];
assert.deepEqual(dayBoundsForTasks(oneBoundary),{start:370,end:1260});
assert.equal(dayBoundsForTasks([{name:'Подъём',time:'06:00',duration:10}]),null);
assert.deepEqual(intervalsFor([{time:'05:00',duration:120},{time:'07:00',duration:60}],{dayStart:360,dayEnd:480}).map(x=>[x.start,x.end]),[[360,420]]);
console.log('day-boundary inference and bounded intervals: assertions passed');

const fallbackBounds=[{name:'Завтрак',time:'07:00',duration:30},{name:'Дела',time:'10:00',duration:60},{name:'Отбой',time:'22:00',duration:1}];
assignDayBoundaryRoles(fallbackBounds);
assert.deepEqual(dayBoundsForTasks(fallbackBounds),{start:450,end:1320});
const overlappingBounds=[{name:'Подъём',time:'06:00',duration:90,dayBoundary:'start'},{name:'Сон',time:'07:00',dayBoundary:'end'}];
assert.equal(dayBoundsForTasks(overlappingBounds),null);
console.log('fallback and invalid day-boundary windows: assertions passed');
