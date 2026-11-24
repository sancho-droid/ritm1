import assert from 'node:assert/strict';
import {DAY_START_MINUTES,DAY_END_MINUTES,parseClock,formatClock,durationOf,syncSleepToWake,overnightContinuation,sortChronologically,intervalsFor,freeIntervals,findNextFreeGap,freeTimeAnchorIndex,conflicts,orderTimedTasksForDisplay,inferDayBoundary,assignDayBoundaryRoles,dayBoundaryIssue,dayBoundaryWindow,freeGapsForDay,timelineTimeForTask,timeScaleBounds,timeScaleRatio,timeScalePosition,timeScaleTaskAnchors,timeScaleOverlapGroups,timeScaleMinuteAtPosition,} from './time-engine.js';
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


// Day boundaries are inferred once from unambiguous task names, then stored on tasks.
assert.equal(inferDayBoundary('Подъём'),'start');
assert.equal(inferDayBoundary('Подъем'),'start');
assert.equal(inferDayBoundary('  ПРОСНУТЬСЯ  '),'start');
assert.equal(inferDayBoundary('Сон'),'end');
assert.equal(inferDayBoundary('Отбой'),'end');
assert.equal(inferDayBoundary('Подъём ребёнка'),null);
assert.deepEqual(dayBoundaryWindow([{dayBoundary:'start',time:'06:00',duration:15},{time:'07:00',duration:30},{dayBoundary:'end',time:'22:30'}]),{startIndex:0,endIndex:2,startMinute:375,endMinute:1350});
assert.equal(dayBoundaryWindow([{dayBoundary:'start',time:'06:00'},{dayBoundary:'end',time:'05:30'}]),null);
assert.equal(dayBoundaryWindow([{dayBoundary:'start',time:'06:00'},{dayBoundary:'start',time:'07:00'},{dayBoundary:'end',time:'22:30'}]),null);
assert.equal(dayBoundaryWindow([{dayBoundary:'start',time:'06:00'}]),null);
console.log('day-boundary inference/window: assertions passed');

 
// Boundary roles are assigned per task, not only when the whole database has one candidate.
const dayMarkers=[{name:'Подъём',time:'06:00',duration:15},{name:'Сон',time:'23:00'}];
assignDayBoundaryRoles(dayMarkers);
assert.equal(dayMarkers[0].dayBoundary,'start');
assert.equal(dayMarkers[1].dayBoundary,'end');
dayMarkers[0].name='Начало дня';
assignDayBoundaryRoles(dayMarkers);
assert.equal(dayMarkers[0].dayBoundary,'start');
const markersAcrossDates=[
  {id:'wake-day-1',name:'Подъём',time:'06:00',date:'2026-11-22'},
  {id:'wake-day-2',name:'Проснуться',time:'07:00',date:'2026-11-23'},
  {id:'sleep-day-1',name:'Сон',time:'22:00',date:'2026-11-22'},
  {id:'sleep-day-2',name:'Отбой',time:'23:00',date:'2026-11-23'}
];
assignDayBoundaryRoles(markersAcrossDates);
assert.deepEqual(markersAcrossDates.map(x=>x.dayBoundary),['start','start','end','end']);
assert.equal(dayBoundaryIssue(markersAcrossDates.filter(x=>x.date==='2026-11-22')),null);
assert.equal(dayBoundaryIssue(markersAcrossDates.filter(x=>x.date==='2026-11-23')),null);
assert.deepEqual(
  dayBoundaryWindow(markersAcrossDates.filter(x=>x.date==='2026-11-22')),
  {startIndex:0,endIndex:1,startMinute:361,endMinute:1320}
);
const ambiguousMarkers=[{name:'Подъём',time:'06:00'},{name:'Проснуться',time:'06:15'},{name:'Сон',time:'23:00'}];
assignDayBoundaryRoles(ambiguousMarkers);
assert.equal(ambiguousMarkers[0].dayBoundary,'start');
assert.equal(ambiguousMarkers[1].dayBoundary,'start');
assert.match(dayBoundaryIssue(ambiguousMarkers),/несколько задач с признаком начала дня/);
assert.equal(dayBoundaryWindow(ambiguousMarkers),null);
assert.match(dayBoundaryIssue([{name:'Подъём',dayBoundary:'start'},{name:'Сон',time:'23:00',dayBoundary:'end'}]),/не задано время/);
console.log('day-boundary per-task migration, rename persistence and same-day ambiguity: assertions passed');

// Sleep end and duration follow wake-time task; crossing midnight is supported.
const sleepSync={name:'Сон',time:'23:00',endTime:'06:00',duration:420};syncSleepToWake(sleepSync,{name:'Подъём',time:'08:00'});assert.deepEqual(sleepSync,{name:'Сон',time:'23:00',endTime:'08:00',duration:540});const sleepCross={name:'Сон',time:'22:00',endTime:'06:00',duration:480};syncSleepToWake(sleepCross,{name:'Подъём',time:'07:00'});assert.deepEqual(sleepCross,{name:'Сон',time:'22:00',endTime:'07:00',duration:540});const sameClockSleep={name:'Сон',time:'23:00',endTime:'07:00',duration:480};syncSleepToWake(sameClockSleep,{name:'Подъём',time:'23:00'});assert.deepEqual(sameClockSleep,{name:'Сон',time:'23:00',endTime:'07:00',duration:480});assert.deepEqual(overnightContinuation({id:'sleep',name:'Сон',time:'23:00',duration:540,endTime:'08:00',dayBoundary:'end'},'2026-11-23'),{id:'sleep@continuation-2026-11-23',name:'Сон (продолжение)',time:'00:00',endTime:'08:00',duration:480,dayBoundary:'continuation',overnightContinuation:true,date:'2026-11-23',displayDate:'2026-11-23'});assert.equal(overnightContinuation({name:'Тренировка',time:'08:00',duration:60},'2026-11-23'),null);console.log('sleep auto-sync and overnight continuation: assertions passed');

// New independent free-time calculation: direct coverage with deterministic date/time inputs.
const gapCalc=(tasks,date,{today='2026-11-23',minute=360,previous=[]}={})=>freeGapsForDay(tasks,date,{todayKey:today,nowMinutes:minute,previousDayTasks:previous});
assert.deepEqual(gapCalc([], '2026-11-22',{today:'2026-11-23'}),[],'past dates must not show free time');
assert.deepEqual(gapCalc([], '2026-11-23',{minute:600}),[{start:'10:00',end:'24:00',duration:840,date:'2026-11-23',afterIndex:-1,id:'2026-11-23-gap-0'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{minute:600}),[{start:'00:00',end:'24:00',duration:1440,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:60},{time:'12:00',duration:30}], '2026-11-24'),[
 {start:'00:00',end:'08:00',duration:480,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},
 {start:'09:00',end:'12:00',duration:180,date:'2026-11-24',afterIndex:0,id:'2026-11-24-gap-1'},
 {start:'12:30',end:'24:00',duration:690,date:'2026-11-24',afterIndex:1,id:'2026-11-24-gap-2'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:60,scheduleMode:'parallel'}], '2026-11-24'),[{start:'00:00',end:'24:00',duration:1440,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:120,done:true,doneAt:'2026-11-24T08:30:00'}], '2026-11-24'),[
 {start:'00:00',end:'08:00',duration:480,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},
 {start:'08:30',end:'24:00',duration:930,date:'2026-11-24',afterIndex:0,id:'2026-11-24-gap-1'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:120,done:true,actualTime:'08:30'}], '2026-11-24'),[
 {start:'00:00',end:'08:00',duration:480,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},
 {start:'08:30',end:'24:00',duration:930,date:'2026-11-24',afterIndex:0,id:'2026-11-24-gap-1'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{previous:[{time:'23:00',duration:120}]}),[{start:'01:00',end:'24:00',duration:1380,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{previous:[{time:'23:00',duration:120,dayBoundary:'end'}]}),[{start:'01:00',end:'24:00',duration:1380,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{previous:[{time:'23:00',duration:120,done:true,doneAt:'2026-11-23T23:30:00'}]}),[{start:'00:00',end:'24:00',duration:1440,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{previous:[{time:'23:00',duration:120,done:true,doneAt:'2026-11-24T00:30:00'}]}),[{start:'00:30',end:'24:00',duration:1410,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([], '2026-11-24',{previous:[{time:'23:00',duration:120,done:true,actualTime:'00:30'}]}),[{start:'00:30',end:'24:00',duration:1410,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'23:30',duration:90,done:true,doneAt:'2026-11-25T00:15:00'}], '2026-11-24'),[{start:'00:00',end:'23:30',duration:1410,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'10:00',duration:10}], '2026-11-24',{today:'2026-11-24',minute:600}),[{start:'10:10',end:'24:00',duration:830,date:'2026-11-24',afterIndex:0,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'10:00',duration:10},{time:'10:10',duration:10}], '2026-11-24',{today:'2026-11-24',minute:600}),[{start:'10:20',end:'24:00',duration:820,date:'2026-11-24',afterIndex:1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:10},{time:'08:05',duration:20}], '2026-11-24'),[{start:'00:00',end:'08:00',duration:480,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},{start:'08:25',end:'24:00',duration:935,date:'2026-11-24',afterIndex:1,id:'2026-11-24-gap-1'}]);
assert.deepEqual(gapCalc([{time:'08:00',duration:10},{time:'08:20',duration:5}], '2026-11-24'),[{start:'00:00',end:'08:00',duration:480,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},{start:'08:25',end:'24:00',duration:935,date:'2026-11-24',afterIndex:1,id:'2026-11-24-gap-1'}]);

// Today's free-time counter must be placed below the current-time position
// and below every task already completed by the current moment, including
// early-completed tasks whose scheduled start is still in the future.
assert.deepEqual(
  gapCalc([{id:'early-done',time:'12:00',duration:60,done:true,doneAt:'2026-11-23T08:30:00'}], '2026-11-23',{today:'2026-11-23',minute:11*60}),
  [{start:'11:00',end:'24:00',duration:780,date:'2026-11-23',afterIndex:0,id:'2026-11-23-gap-0'}]
);
assert.deepEqual(
  gapCalc([{id:'not-yet-done',time:'12:00',duration:60,done:true,doneAt:'2026-11-23T11:05:00'}], '2026-11-23',{today:'2026-11-23',minute:11*60}),
  [{start:'11:00',end:'24:00',duration:780,date:'2026-11-23',afterIndex:-1,id:'2026-11-23-gap-0'}]
);
assert.deepEqual(
  gapCalc([{id:'past',time:'09:00',duration:30},{id:'early-done',time:'12:00',duration:60,done:true,doneAt:'2026-11-23T08:30:00'}], '2026-11-23',{today:'2026-11-23',minute:11*60}),
  [{start:'11:00',end:'24:00',duration:780,date:'2026-11-23',afterIndex:1,id:'2026-11-23-gap-0'}]
);

console.log('independent free-gap engine: regression and boundary assertions passed');

// Legacy actualTime for a task crossing midnight must be interpreted as an overnight clock when it wraps.
assert.deepEqual(gapCalc([{time:'23:00',duration:120,done:true,actualTime:'00:30'}], '2026-11-24'),[{start:'00:00',end:'23:00',duration:1380,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);
assert.deepEqual(gapCalc([{time:'23:00',duration:120,done:true,actualTime:'23:30'}], '2026-11-24'),[{start:'00:00',end:'23:00',duration:1380,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},{start:'23:30',end:'24:00',duration:30,date:'2026-11-24',afterIndex:0,id:'2026-11-24-gap-1'}]);

// A legacy clock before a late scheduled start is ambiguous; low post-midnight clocks wrap, evening clocks remain early.
assert.deepEqual(gapCalc([{time:'23:00',duration:120,done:true,actualTime:'22:30'}], '2026-11-24'),[{start:'00:00',end:'24:00',duration:1440,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'}]);


// Left time rail: planned start is the default; only a genuine early completion
// may display its actual completion clock. The task card's planned interval stays intact.
const railNow=new Date(2026,10,23,11,0,0);
const earlyRailTask={time:'12:00',duration:60,done:true,doneAt:'2026-11-23T08:30:00',actualTime:'08:30',completionKind:'early',occurrenceDate:'2026-11-23'};
assert.equal(timelineTimeForTask(earlyRailTask,railNow),'08:30');
assert.equal(earlyRailTask.time,'12:00','left rail must not rewrite the planned card time');
assert.equal(timelineTimeForTask({...earlyRailTask,done:false},railNow),'12:00','cancelled completion returns to planned time');
assert.equal(timelineTimeForTask({...earlyRailTask,doneAt:'2026-11-23T12:00:00',actualTime:'12:00',completionKind:'on-time-or-late'},railNow),'12:00','on-time completion keeps planned time');
assert.equal(timelineTimeForTask({...earlyRailTask,doneAt:'2026-11-23T12:15:00',actualTime:'12:15',completionKind:'on-time-or-late'},railNow),'12:00','late completion keeps planned time');
assert.equal(timelineTimeForTask({...earlyRailTask,doneAt:'2026-11-23T11:30:00',actualTime:'11:30',completionKind:'early'},railNow),'12:00','future completion timestamp is not shown yet');
assert.equal(timelineTimeForTask({time:'',done:true,actualTime:'08:30'},railNow),null,'untimed task has no rail label');
assert.equal(timelineTimeForTask({time:'12:00',done:true,actualTime:'08:30',completionKind:'early'},railNow),'08:30','legacy early completion without doneAt remains supported');
assert.equal(timelineTimeForTask({...earlyRailTask,displayDate:'2026-11-23',occurrenceDate:'2026-11-22'},railNow),'08:30','moved occurrence uses its displayed date, not its source occurrence key');
assert.deepEqual(
  timeScaleBounds([
    {time:'06:00',duration:30},
    earlyRailTask,
    {time:'22:00',duration:90}
  ],railNow),
  {start:360,end:1410},
  'dynamic bounds use first displayed time and final scheduled end'
);
assert.deepEqual(timeScaleBounds([{time:'23:00',duration:120}],railNow),{start:1380,end:1500},'overnight task extends the dynamic end boundary past midnight');
assert.equal(timeScaleBounds([{name:'no time',time:''}],railNow),null,'no timed tasks means no visible scale range');
console.log('left time rail labels and dynamic bounds: assertions passed');

assert.equal(timeScaleRatio(360, 1080, 720), 0.5);
assert.equal(timeScaleRatio(360, 1080, 360), 0);
assert.equal(timeScaleRatio(360, 1080, 1080), 1);
assert.equal(timeScaleRatio(360, 1080, 359), null);
assert.equal(timeScaleRatio(360, 1080, 1081), null);
assert.equal(timeScaleRatio(360, 360, 360), null);
assert.equal(timeScaleRatio(1380, 1800, 1500), 120/420);
console.log('current-time bead mapping: assertions passed');

assert.equal(timeScalePosition([{minute:0,y:10},{minute:60,y:70},{minute:120,y:130}],30),40);
assert.equal(timeScalePosition([{minute:0,y:10},{minute:60,y:70},{minute:120,y:130}],60),70);
assert.equal(timeScalePosition([{minute:0,y:10},{minute:60,y:70}],-1),null);
assert.equal(timeScalePosition([{minute:0,y:10},{minute:60,y:70}],61),null);
assert.equal(timeScalePosition([{minute:0,y:10},{minute:60,y:70},{minute:30,y:80}],45),80,'overlapping visual anchors never make the bead move backwards');
assert.equal(timeScalePosition([{minute:0,y:10},{minute:0,y:20},{minute:60,y:80}],0),10,
  'at an equal-time boundary, the exact timestamp belongs to the first edge rather than collapsing to the later card edge');
const firstBoundaryAnchors=timeScaleTaskAnchors(720,30,100,200);
const secondBoundaryAnchors=timeScaleTaskAnchors(750,30,212,312);
const sharedBoundaryAnchors=[...firstBoundaryAnchors,...secondBoundaryAnchors];
assert.equal(timeScalePosition(sharedBoundaryAnchors,720),100,'task start aligns to its visible top border');
assert.equal(timeScalePosition(sharedBoundaryAnchors,735),150,'bead moves proportionally inside the first card');
assert.equal(timeScalePosition(sharedBoundaryAnchors,750),200,'task end aligns to the visible bottom border at the shared minute');
assert.ok(timeScalePosition(sharedBoundaryAnchors,750.001)>212,'after the shared minute the bead continues from the next card top, preserving the inter-card gap');
assert.equal(timeScalePosition(sharedBoundaryAnchors,765),262,'the next task uses its own card geometry');

assert.deepEqual(timeScaleTaskAnchors(637,220,100,320),[{minute:637,y:100},{minute:857,y:320}],
  'a 3h40m task spans its complete card height');
assert.equal(timeScalePosition(timeScaleTaskAnchors(637,220,100,320),747),210,
  'bead is proportional to elapsed time inside a task card');
assert.equal(timeScalePosition(timeScaleTaskAnchors(637,15,100,160),644.5),130,
  'a 15-minute task uses its full card height');
assert.deepEqual(timeScaleTaskAnchors(600,0,100,160),[{minute:600,y:130},{minute:601,y:160}],
  'a point task keeps the established midpoint anchor for the current-time bead');
assert.equal(timeScalePosition(timeScaleTaskAnchors(600,0,100,160),600),130);
assert.equal(timeScalePosition(timeScaleTaskAnchors(600,0,100,160),601),160);
console.log('task-proportional current-time bead anchors: assertions passed');


// Drag uses the exact inverse of the same measured piecewise geometry as the current-time bead.
const inverseGeometry=[
 {minute:360,y:100},{minute:480,y:145},{minute:510,y:205},
 {minute:600,y:230},{minute:660,y:250},{minute:690,y:310}
];
for(let minute=360;minute<=690;minute+=3){
 const y=timeScalePosition(inverseGeometry,minute);
 assert.ok(Math.abs(timeScaleMinuteAtPosition(inverseGeometry,y)-minute)<1e-7,
   'Y-to-time inversion must round-trip variable task/free-gap geometry at '+minute);
}
const sharedMinuteGap=[{minute:480,y:100},{minute:510,y:150},{minute:510,y:162},{minute:540,y:222}];
assert.equal(timeScaleMinuteAtPosition(sharedMinuteGap,156),510,'visual gap between adjacent card edges maps to their shared minute');
assert.equal(timeScaleMinuteAtPosition(sharedMinuteGap,100),480);
assert.equal(timeScaleMinuteAtPosition(sharedMinuteGap,222),540);
assert.equal(timeScaleMinuteAtPosition(sharedMinuteGap,99),null,'drag cannot extrapolate above measured anchors');
assert.equal(timeScaleMinuteAtPosition(sharedMinuteGap,223),null,'drag cannot extrapolate below measured anchors');
console.log('inverse drag timeline geometry: assertions passed');


// Overlapping tasks share one visual time group whose end follows the longest interval.
const overlapNow=new Date(2026,10,24,12,30);
assert.deepEqual(timeScaleOverlapGroups([
  {id:'long',time:'12:00',duration:120},
  {id:'short',time:'12:00',duration:60},
  {id:'after',time:'14:00',duration:30}
],overlapNow),[
  {start:720,end:840,indices:[0,1],lanes:[0,1],laneCount:2},
  {start:840,end:870,indices:[2],lanes:[0],laneCount:1}
],'same-start tasks group to the longest end; touching tasks remain separate');
assert.deepEqual(timeScaleOverlapGroups([
  {id:'first',time:'12:00',duration:60},
  {id:'second',time:'12:45',duration:75},
  {id:'third',time:'13:50',duration:40}
],overlapNow),[
  {start:720,end:870,indices:[0,1,2],lanes:[0,1,0],laneCount:2}
],'transitively overlapping tasks form one continuous group');
assert.deepEqual(timeScaleOverlapGroups([
  {id:'fixed',time:'12:00',duration:90},
  {id:'parallel',time:'12:30',duration:30,scheduleMode:'parallel'}
],overlapNow),[
  {start:720,end:810,indices:[0,1],lanes:[0,1],laneCount:2}
],'parallel tasks remain visible in the same visual time group');
assert.deepEqual(timeScaleOverlapGroups([
  {id:'completed',time:'13:00',duration:120,done:true,doneAt:'2026-11-24T12:15:00',actualTime:'12:15'},
  {id:'active',time:'12:10',duration:60}
],overlapNow),[
  {start:730,end:790,indices:[1,0],lanes:[0,1],laneCount:2}
],'completed tasks use their effective completion clock as a point event');
console.log('overlapping timeline groups: regression assertions passed');

// Free-time boundaries must use the union of all overlapping occupied intervals.
assert.deepEqual(gapCalc([
  {time:'12:00',duration:120},
  {time:'12:00',duration:60}
], '2026-11-24'),[
  {start:'00:00',end:'12:00',duration:720,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},
  {start:'14:00',end:'24:00',duration:600,date:'2026-11-24',afterIndex:1,id:'2026-11-24-gap-1'}
],'nested same-start tasks must leave free time only after the longer task ends');
assert.deepEqual(gapCalc([
  {time:'12:00',duration:60},
  {time:'12:45',duration:75},
  {time:'13:50',duration:40}
], '2026-11-24'),[
  {start:'00:00',end:'12:00',duration:720,date:'2026-11-24',afterIndex:-1,id:'2026-11-24-gap-0'},
  {start:'14:30',end:'24:00',duration:570,date:'2026-11-24',afterIndex:2,id:'2026-11-24-gap-1'}
],'transitively overlapping tasks must merge to the latest end');
console.log('overlapping free-time intervals: regression assertions passed');

// Non-overlapping tasks can reuse a lane inside one transitive overlap group.
assert.deepEqual(timeScaleOverlapGroups([
  {id:'first',time:'12:00',duration:120},
  {id:'middle',time:'12:30',duration:30},
  {id:'last',time:'13:00',duration:30}
],overlapNow),[
  {start:720,end:840,indices:[0,1,2],lanes:[0,1,1],laneCount:2}
],'a lane is reused as soon as its previous task ends');

assert.deepEqual(timeScaleOverlapGroups([
  {id:'later',time:'13:30',duration:30},
  {id:'long',time:'12:00',duration:120},
  {id:'short',time:'12:15',duration:30}
],overlapNow),[
  {start:720,end:840,indices:[1,2,0],lanes:[0,1,1],laneCount:2}
],'groups are ordered by effective clock time even when early-completed cards were reordered in the display list');
console.log('overlap timeline lane assignment: assertions passed');
