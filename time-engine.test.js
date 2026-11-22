import assert from 'node:assert/strict';
import {parseClock,formatClock,durationOf,sortChronologically,intervalsFor,freeIntervals,conflicts,orderTimedTasksForDisplay,} from './time-engine.js';
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
