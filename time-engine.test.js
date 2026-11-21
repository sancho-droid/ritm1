import assert from 'node:assert/strict';
import {parseClock,formatClock,durationOf,sortChronologically,intervalsFor,freeIntervals,conflicts,minuteToY,yToMinute,createTimelineAnchors,timelineMinutesAtY,timelineYAtMinutes} from './time-engine.js';
assert.equal(parseClock('00:00'),0);assert.equal(parseClock('19:09'),1149);assert.equal(parseClock('23:59'),1439);assert.equal(parseClock('24:00'),null);assert.equal(parseClock('9:00'),null);assert.equal(parseClock('bad'),null);assert.equal(formatClock(1149),'19:09');assert.equal(formatClock(1440),'23:59');
assert.deepEqual(sortChronologically([{id:'a',time:'20:15'},{id:'b',time:'17:20'},{id:'c',time:'19:00'},{id:'d',time:''}]).map(x=>x.time),['17:20','19:00','20:15','']);assert.deepEqual(sortChronologically([{id:'z',time:'09:00'},{id:'a',time:'09:00'}]).map(x=>x.id),['z','a']);
assert.equal(durationOf({time:'23:30',endTime:'00:15'}),45);assert.deepEqual(intervalsFor([{time:'17:20',duration:30},{time:'17:45',duration:30},{time:'18:15',duration:15,done:true},{time:'19:00',duration:20}]).map(x=>[x.start,x.end]),[[1040,1095],[1140,1160]]);
assert.deepEqual(freeIntervals([{time:'17:20',duration:40},{time:'19:00',duration:20}],{nowMinutes:1080,dayEnd:1380,minGap:15}).map(x=>[x.start,x.end]),[[1080,1140],[1160,1380]]);assert.deepEqual(intervalsFor([{time:'20:15',duration:30},{time:'17:20',duration:25},{time:'19:00',duration:40},{time:'19:20',duration:20}]).map(x=>[x.start,x.end]),[[1040,1065],[1140,1180],[1215,1245]]);
assert.equal(conflicts({time:'18:00',duration:60},[{id:'x',time:'18:30',duration:20}]).length,1);assert.equal(conflicts({time:'18:00',duration:30},[{id:'x',time:'18:30',duration:20}]).length,0);
assert.equal(minuteToY(1140,{originMinute:1020,pixelsPerMinute:2}),240);assert.equal(yToMinute(240,{originMinute:1020,pixelsPerMinute:2,step:5}),1140);
console.log('time-engine: assertions passed');
const scale=createTimelineAnchors([
 {minutes:480,y:100,kind:'start'},{minutes:540,y:160,kind:'end'},{minutes:600,y:220,kind:'start'}
],{originMinute:480,originY:100,pixelsPerMinute:1});
assert.equal(scale.some(a=>a.minutes===480&&a.kind==='start'),true);
assert.equal(scale.some(a=>a.minutes===540&&a.kind==='end'),true);
assert.equal(scale.some(a=>a.minutes===600&&a.kind==='start'),true);
assert.equal(timelineYAtMinutes(510,scale),130);
assert.equal(timelineMinutesAtY(130,scale),510);
assert.equal(timelineYAtMinutes(570,scale),190);
assert.equal(timelineMinutesAtY(190,scale),570);
const fallbackScale=createTimelineAnchors([],{originMinute:480,originY:100,pixelsPerMinute:1});
assert.equal(fallbackScale.some(a=>a.minutes===540&&a.kind==='hour'),true);
assert.equal(timelineYAtMinutes(540,fallbackScale),160);
assert.equal(timelineMinutesAtY(160,fallbackScale),540);
const overlapScale=createTimelineAnchors([
 {minutes:540,y:100,kind:'start'},{minutes:720,y:160,kind:'end'},{minutes:600,y:170,kind:'start'}
],{originMinute:480,originY:100,pixelsPerMinute:1});
assert.equal(overlapScale.some(a=>a.minutes===600&&a.kind==='start'),true);
assert.equal(overlapScale.some(a=>a.minutes===720&&a.kind==='end'),false);
console.log('timeline scale: assertions passed');

// Parallel tasks are visible, but do not occupy free time or create conflicts.
assert.deepEqual(intervalsFor([{time:'14:00',duration:180,scheduleMode:'parallel'},{time:'14:00',duration:180}]).map(x=>[x.start,x.end]),[[840,1020]]);
assert.deepEqual(freeIntervals([{time:'14:00',duration:180,scheduleMode:'parallel'}],{nowMinutes:780,dayEnd:1080,minGap:15}).map(x=>[x.start,x.end]),[[780,1080]]);
assert.equal(conflicts({time:'14:00',duration:60,scheduleMode:'parallel'},[{time:'14:30',duration:30}]).length,0);
assert.equal(conflicts({time:'14:00',duration:60},[{time:'14:30',duration:30,scheduleMode:'parallel'}]).length,0);
// Family event duration is inferred from start/end, including midnight crossing.
assert.equal(durationOf({time:'14:00',endTime:'17:00',duration:0}),180);
assert.equal(durationOf({time:'23:00',endTime:'01:00',duration:0}),120);
// A single global timeline scale remains strictly increasing in both domains.
const strictScale=createTimelineAnchors([{minutes:540,y:100,kind:'start'},{minutes:720,y:160,kind:'end'},{minutes:600,y:170,kind:'start'},{minutes:780,y:240,kind:'end'}],{originMinute:480,originY:40,pixelsPerMinute:1});
for(let i=1;i<strictScale.length;i++){assert.ok(strictScale[i].minutes>strictScale[i-1].minutes);assert.ok(strictScale[i].y>strictScale[i-1].y)}
for(let minute=0;minute<1440;minute+=15){const y=timelineYAtMinutes(minute,strictScale);const back=timelineMinutesAtY(y,strictScale);assert.ok(Math.abs(back-minute)<1e-8)}
console.log('parallel tasks, family intervals and strict timeline: assertions passed');

// Family events with an end time occupy the full interval in free-time and conflict calculations.
assert.deepEqual(freeIntervals([{time:'14:00',endTime:'17:00',duration:0,isFamily:true}],{nowMinutes:780,dayEnd:1080,minGap:15}).map(x=>[x.start,x.end]),[[780,840],[1020,1080]]);
assert.equal(conflicts({id:'candidate',time:'16:30',duration:30},[{id:'family',time:'14:00',endTime:'17:00',duration:0,isFamily:true}]).length,1);
console.log('family interval conflict/free-time: assertions passed');
