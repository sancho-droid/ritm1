/** Ритм: pure time calculations, independent from DOM/CSS. */
export const DAY_MINUTES=1440, DAY_START_MINUTES=0, DAY_END_MINUTES=23*60+59;
export function parseClock(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))return null;const [,h,m]=value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);return Number(h)*60+Number(m)}
export function formatClock(minutes){const n=Math.max(0,Math.min(DAY_MINUTES-1,Math.round(minutes)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
const DAY_START_NAMES=new Set(['подъём','подъем','проснуться','встать','пробуждение','утренний подъём','утренний подъем']);
const DAY_END_NAMES=new Set(['сон','отбой','лечь спать','ко сну','ночной сон']);
export function inferDayBoundary(name){
  const normalized=String(name||'').normalize('NFC').trim().toLocaleLowerCase('ru-RU').replace(/[.!?]+$/,'').replace(/\s+/g,' ');
  if(DAY_START_NAMES.has(normalized))return 'start';
  if(DAY_END_NAMES.has(normalized))return 'end';
  return null;
}
export function dayBoundaryWindow(tasks){
  const starts=[],ends=[];
  (tasks||[]).forEach((task,index)=>{
    if(task?.dayBoundary==='start')starts.push({task,index});
    if(task?.dayBoundary==='end')ends.push({task,index});
  });
  if(starts.length!==1||ends.length!==1)return null;
  const start=parseClock(starts[0].task.time),end=parseClock(ends[0].task.time);
  if(start===null||end===null)return null;
  const startMinute=start+durationOf(starts[0].task);
  if(startMinute>=end)return null;
  return {startIndex:starts[0].index,endIndex:ends[0].index,startMinute,endMinute:end};
}

export function assignDayBoundaryRoles(tasks){
  const list=Array.isArray(tasks)?tasks:[];
  // Boundary identity belongs to each task, not to the entire database.
  // Multiple tasks with the same boundary name may belong to different dates;
  // ambiguity is checked later against the selected day's occurrences.
  for(const task of list){
    if(task?.dayBoundary)continue;
    const role=inferDayBoundary(task?.name);
    if(role)task.dayBoundary=role;
  }
  return list;
}
export function dayBoundaryIssue(tasks){
  const list=Array.isArray(tasks)?tasks:[];
  for(const role of ['start','end']){
    const explicit=list.filter(task=>task?.dayBoundary===role);
    if(explicit.length>1)return role==='start'?'Найдено несколько задач с признаком начала дня':'Найдено несколько задач с признаком конца дня';
    if(!explicit.length){
      const candidates=list.filter(task=>!task?.dayBoundary&&inferDayBoundary(task?.name)===role);
      if(candidates.length>1)return role==='start'?'Найдено несколько кандидатов на начало дня':'Найдено несколько кандидатов на конец дня';
      if(!candidates.length)return role==='start'?'Не найдена задача начала дня («Подъём»)':'Не найдена задача конца дня («Сон»)'; 
    }else if(parseClock(explicit[0]?.time)===null){
      return role==='start'?'У задачи начала дня не задано время':'У задачи конца дня не задано время';
    }
  }
  return null;
}
export function durationOf(task){const d=Number(task?.duration);if(Number.isFinite(d)&&d>0)return Math.round(d);const s=parseClock(task?.time),e=parseClock(task?.endTime);if(s!==null&&e!==null){let diff=e-s;if(diff<0)diff+=DAY_MINUTES;if(diff>0)return diff}return 1}

/** Hidden calculation interval: starts one second after the displayed minute, while the original end stays unchanged. */
export function conflictInterval(task){const start=parseClock(task?.time);if(start===null)return null;return {start:start+1/60,end:start+durationOf(task)}}
export function orderTimedTasksForDisplay(tasks,date,now=new Date()){
  const dateKey=typeof date==='string'?date:localDateKey(date);
  const todayKey=localDateKey(now);
  const cutoff=dateKey<todayKey?DAY_MINUTES:dateKey>todayKey?-1:now.getHours()*60+now.getMinutes();
  const ordered=sortChronologically(tasks||[]);
  const early=[],fixed=[];
  for(const task of ordered){
    const planned=parseClock(task?.time);
    const taskDate=task?.occurrenceDate||task?.displayDate||task?.date||dateKey;
    const scheduledAt=planned===null?NaN:localDateTime(taskDate,planned);
    const completedAt=Date.parse(task?.doneAt||'');
    const legacyActual=parseClock(task?.actualTime);
    const completedBeforeSchedule=Number.isFinite(completedAt)
      ? completedAt<scheduledAt
      : legacyActual!==null&&planned!==null&&legacyActual<planned;
    const stillBeforeSchedule=planned!==null&&planned>cutoff;
    if(task?.done&&planned!==null&&completedBeforeSchedule&&stillBeforeSchedule)early.push(task);
    else fixed.push(task);
  }
  let anchor=-1;
  for(let i=0;i<fixed.length;i++){
    const planned=parseClock(fixed[i]?.time);
    if(planned!==null&&planned<=cutoff)anchor=i;
  }
  fixed.splice(anchor+1,0,...early);
  return fixed;
}
function localDateKey(date){
  return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
}
function localDateTime(dateKey,minutes){
  if(!dateKey)return NaN;
  const [year,month,day]=dateKey.split('-').map(Number);
  if(!year||!month||!day)return NaN;
  return new Date(year,month-1,day,Math.floor(minutes/60),minutes%60).getTime();
}

/** Time shown in the left schedule rail: planned start, except genuine early completion. */
export function timelineTimeForTask(task,now=new Date()){
  const planned=parseClock(task?.time);
  if(planned===null)return null;
  if(!task?.done)return task.time;
  const actual=parseClock(task?.actualTime);
  if(actual===null)return task.time;
  const taskDate=task?.displayDate||task?.occurrenceDate||task?.date;
  const scheduledAt=taskDate?localDateTime(taskDate,planned):NaN;
  const completedAt=Date.parse(task?.doneAt||'');
  const completedBeforeSchedule=Number.isFinite(completedAt)&&Number.isFinite(scheduledAt)
    ? completedAt<scheduledAt
    : task?.completionKind==='early'||(!task?.completionKind&&actual<planned);
  const completionIsPast=!Number.isFinite(completedAt)||completedAt<=now.getTime();
  return completedBeforeSchedule&&completionIsPast?task.actualTime:task.time;
}

/** Dynamic hidden boundaries for the visible timed-task range, not a 24-hour scale. */
export function timeScaleBounds(tasks,now=new Date()){
  let start=Infinity,end=-Infinity;
  for(const task of tasks||[]){
    const planned=parseClock(task?.time);
    if(planned===null)continue;
    const label=parseClock(timelineTimeForTask(task,now)??task.time);
    if(label!==null)start=Math.min(start,label);
    end=Math.max(end,planned+durationOf(task));
  }
  return Number.isFinite(start)&&Number.isFinite(end)?{start,end}:null;
}
/** Map the current clock minute onto the dynamic visible time range. */
export function timeScaleRatio(start,end,minute){if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(minute)||end<=start||minute<start||minute>end)return null;return (minute-start)/(end-start)}

/** Build visual anchors for a task's actual timeline geometry. */
export function timeScaleTaskAnchors(startMinute,duration,top,bottom){
  if(!Number.isFinite(startMinute)||!Number.isFinite(top)||!Number.isFinite(bottom))return [];
  const span=Number.isFinite(duration)&&duration>0?duration:0;
  if(span>0)return [{minute:startMinute,y:top},{minute:startMinute+span,y:bottom}];
  return [{minute:startMinute,y:(top+bottom)/2},{minute:startMinute+1,y:bottom}];
}

/** Group visually overlapping timed tasks into one continuous time interval.
 * The indices refer to the original input order so the UI can map each group
 * back to its rendered cards. Completed tasks are point events at their
 * effective display time; parallel tasks remain visible and join visual groups.
 */
export function timeScaleOverlapGroups(tasks,now=new Date()){
  const entries=[];
  (tasks||[]).forEach((task,index)=>{
    const start=parseClock(timelineTimeForTask(task,now)??task?.time);
    if(start===null)return;
    const duration=task?.done?0:durationOf(task);
    entries.push({index,start,end:start+Math.max(1,duration)});
  });
  entries.sort((a,b)=>a.start-b.start||a.index-b.index);
  const groups=[];
  for(const entry of entries){
    const last=groups[groups.length-1];
    if(last&&entry.start<last.end){
      last.end=Math.max(last.end,entry.end);
      last.indices.push(entry.index);
    }else groups.push({start:entry.start,end:entry.end,indices:[entry.index]});
  }
  return groups;
}

/** Interpolate a vertical position from real schedule anchors.
 * Equal-time anchors can represent two different card edges: the previous
 * card's bottom and the next card's top. Keep both instead of flattening the
 * visual gap. At the exact shared minute, use the first edge (previous bottom);
 * immediately after it, continue from the last edge (next top).
 */
export function timeScalePosition(anchors,minute){
  if(!Array.isArray(anchors)||!Number.isFinite(minute))return null;
  const sorted=anchors.filter(point=>Number.isFinite(point?.minute)&&Number.isFinite(point?.y))
    .sort((a,b)=>a.minute-b.minute||a.y-b.y);
  if(sorted.length<2||minute<sorted[0].minute||minute>sorted[sorted.length-1].minute)return null;
  const groups=[];
  for(const point of sorted){
    const last=groups[groups.length-1];
    if(last&&point.minute===last.minute){last.lastY=point.y;continue;}
    groups.push({minute:point.minute,firstY:point.y,lastY:point.y});
  }
  if(groups.length<2||minute<groups[0].minute||minute>groups[groups.length-1].minute)return null;
  // Preserve forward-only geometry for overlapping/out-of-order visual anchors,
  // while retaining the distinct top/bottom edges inside an equal-time group.
  for(let i=1;i<groups.length;i++){
    const previous=groups[i-1],current=groups[i];
    current.firstY=Math.max(previous.lastY,current.firstY);
    current.lastY=Math.max(current.firstY,current.lastY);
  }
  for(let i=0;i<groups.length;i++){
    const current=groups[i];
    if(minute===current.minute)return current.firstY;
    const next=groups[i+1];
    if(next&&minute<next.minute){
      const ratio=(minute-current.minute)/(next.minute-current.minute);
      return current.lastY+ratio*(next.firstY-current.lastY);
    }
  }
  return groups[groups.length-1].firstY;
}
/** Invert the rendered timeline geometry. Vertical space between two edges
 * that share a minute belongs to that same minute; gaps between distinct
 * minute anchors are interpolated linearly. Values outside the measured scale
 * are rejected rather than extrapolated.
 */
export function timeScaleMinuteAtPosition(anchors,y){
  if(!Array.isArray(anchors)||!Number.isFinite(y))return null;
  const sorted=anchors.filter(point=>Number.isFinite(point?.minute)&&Number.isFinite(point?.y))
    .sort((a,b)=>a.minute-b.minute||a.y-b.y);
  if(sorted.length<2)return null;
  const groups=[];
  for(const point of sorted){
    const last=groups[groups.length-1];
    if(last&&point.minute===last.minute){last.lastY=point.y;continue;}
    groups.push({minute:point.minute,firstY:point.y,lastY:point.y});
  }
  if(groups.length<2)return null;
  for(let i=1;i<groups.length;i++){
    const previous=groups[i-1],current=groups[i];
    current.firstY=Math.max(previous.lastY,current.firstY);
    current.lastY=Math.max(current.firstY,current.lastY);
  }
  if(y<groups[0].firstY||y>groups[groups.length-1].lastY)return null;
  for(let i=0;i<groups.length;i++){
    const current=groups[i],next=groups[i+1];
    if(y>=current.firstY&&y<=current.lastY)return current.minute;
    if(next&&y>current.lastY&&y<next.firstY){
      const span=next.firstY-current.lastY;
      return span>0?current.minute+(y-current.lastY)*(next.minute-current.minute)/span:current.minute;
    }
  }
  return y===groups[groups.length-1].lastY?groups[groups.length-1].minute:null;
}
export function sortChronologically(tasks){return [...tasks].sort((a,b)=>{const am=parseClock(a?.time),bm=parseClock(b?.time);if(am===null&&bm===null)return 0;if(am===null)return 1;if(bm===null)return-1;return am-bm})}
export function intervalsFor(tasks,{includeCompleted=false,dayEnd=DAY_END_MINUTES}={}){const list=[];for(const task of tasks||[]){const start=parseClock(task?.time);if(start===null||task?.scheduleMode==='parallel'||(!includeCompleted&&task?.done))continue;const end=Math.min(dayEnd,start+durationOf(task));if(end>start)list.push({start,end,task})}list.sort((a,b)=>a.start-b.start||a.end-b.end);const merged=[];for(const item of list){const last=merged.at(-1);if(last&&item.start<last.end){last.end=Math.max(last.end,item.end);last.tasks.push(item.task)}else merged.push({start:item.start,end:item.end,tasks:[item.task]})}return merged}
export function freeIntervals(tasks,{nowMinutes=null,dayEnd=DAY_END_MINUTES,minGap=15}={}){const occupied=intervalsFor(tasks,{dayEnd});const gaps=[];let cursor=Math.max(0,nowMinutes??0);for(const block of occupied){if(block.end<=cursor)continue;if(block.start-cursor>=minGap)gaps.push({start:cursor,end:block.start,duration:block.start-cursor});cursor=Math.max(cursor,block.end)}if(dayEnd-cursor>=minGap)gaps.push({start:cursor,end:dayEnd,duration:dayEnd-cursor});return gaps}

/** Find the first useful free interval at/after now, skipping gaps shorter than minGap. */

/** Latest task that has started or was already completed today. */
export function freeTimeAnchorIndex(tasks,dateKey,nowMinutes){
  let anchor=-1;
  (tasks||[]).forEach((task,index)=>{
    const start=parseClock(task?.time);
    let completedMinute=null;
    const completedAt=Date.parse(task?.doneAt||'');
    if(Number.isFinite(completedAt)){
      const completedDate=new Date(completedAt);
      if(localDateKey(completedDate)===dateKey)completedMinute=completedDate.getHours()*60+completedDate.getMinutes();
    }else completedMinute=parseClock(task?.actualTime);
    if((start!==null&&start<=nowMinutes)||(task?.done&&completedMinute!==null&&completedMinute<=nowMinutes))anchor=index;
  });
  return anchor;
}

export function findNextFreeGap(occupied,nowMinutes,afterIndex=-1,{dayEnd=DAY_END_MINUTES,minGap=15}={}){
  let cursor=Math.max(DAY_START_MINUTES,Math.min(dayEnd,nowMinutes));
  let anchor=afterIndex;
  for(const block of occupied||[]){
    if(block.end<=cursor){
      for(const task of block.tasks||[])if(Number.isInteger(task?._freeTimeIndex))anchor=Math.max(anchor,task._freeTimeIndex);
      continue;
    }
    if(block.start>cursor){
      const duration=block.start-cursor;
      if(duration>=minGap)return {start:cursor,end:block.start,duration,afterIndex:anchor};
    }
    cursor=Math.max(cursor,block.end);
    for(const task of block.tasks||[])if(Number.isInteger(task?._freeTimeIndex))anchor=Math.max(anchor,task._freeTimeIndex);
  }
  const duration=dayEnd-cursor;
  return duration>=minGap?{start:cursor,end:dayEnd,duration,afterIndex:anchor}:null;
}

export function conflicts(candidate,tasks){const start=parseClock(candidate?.time);if(start===null||candidate?.scheduleMode==='parallel')return[];const end=start+durationOf(candidate);return(tasks||[]).filter(t=>{if(t===candidate||t?.id===candidate?.id||t?.done||t?.scheduleMode==='parallel')return false;const otherStart=parseClock(t?.time);if(otherStart===null)return false;const otherEnd=otherStart+durationOf(t);return start<otherEnd&&otherStart<end})}

/** Sync a sleep task's end/duration to the selected wake-time task. */
export function syncSleepToWake(sleep,wake){const start=parseClock(sleep?.time),end=parseClock(wake?.time);if(start===null||end===null||start===end)return sleep;let duration=end-start;if(duration<0)duration+=DAY_MINUTES;sleep.endTime=wake.time;sleep.duration=duration;return sleep;}

/** Build the next-day visual/occupancy segment for a task crossing midnight. */
export function overnightContinuation(task,dateKey){const start=parseClock(task?.time),duration=durationOf(task);if(start===null||duration<=0||start+duration<=DAY_MINUTES)return null;const remaining=start+duration-DAY_MINUTES;return {...task,id:String(task.id||'')+'@continuation-'+dateKey,name:String(task.name||'')+' (продолжение)',time:'00:00',endTime:formatClock(remaining),duration:remaining,dayBoundary:'continuation',overnightContinuation:true,date:dateKey,displayDate:dateKey};}

/** Calculate date-specific free gaps, including spillover from the previous day.
 * now is injectable for deterministic tests; previousDayTasks must be occurrences for that date.
 */
export function freeGapsForDay(tasks,dateKey,{todayKey,nowMinutes=0,previousDayTasks=[],minGap=15}={}){
  if(!dateKey||!todayKey||dateKey<todayKey)return[];
  const dayStart=dateKey===todayKey?Math.max(0,Math.min(1439,Math.floor(nowMinutes))):0;
  const current=Array.isArray(tasks)?tasks:[],prior=Array.isArray(previousDayTasks)?previousDayTasks:[];
  const occupied=[];
  const localKey=d=>String(d.getFullYear()).padStart(4,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const dateOffset=(key,days)=>{const [y,m,d]=key.split('-').map(Number);const date=new Date(y,m-1,d,12);date.setDate(date.getDate()+days);return localKey(date)};
  const prevKey=dateOffset(dateKey,-1),nextKey=dateOffset(dateKey,1);
  const crosses=(t)=>{const start=parseClock(t?.time);return start!==null&&start+durationOf(t)>DAY_MINUTES;};
  for(const task of [...current,...prior.filter(t=>crosses(t)||t?.dayBoundary==='end').map(t=>({...t,_priorDate:true}))]){
    if(!task?.time||task.scheduleMode==='parallel')continue;
    const s=parseClock(task.time);if(s===null)continue;
    let start=s,duration=durationOf(task);
    if(task._priorDate){const spill=Math.max(0,s+duration-DAY_MINUTES);if(!spill)continue;start=0;duration=spill;
      if(task.done){const stamp=Date.parse(task.doneAt||'');if(Number.isFinite(stamp)){const completed=localKey(new Date(stamp)),minute=new Date(stamp).getHours()*60+new Date(stamp).getMinutes();if(completed===prevKey)duration=0;else if(completed===dateKey)duration=Math.min(duration,Math.max(0,minute));}
        else {const actual=parseClock(task.actualTime);if(actual!==null)duration=Math.min(duration,Math.max(0,actual));}}
    }else{
      const crossesMidnight=s+duration>DAY_MINUTES;
      if(crossesMidnight)duration=DAY_MINUTES-s;
      if(task.done){const stamp=Date.parse(task.doneAt||'');if(Number.isFinite(stamp)){const completed=new Date(stamp),completedKey=localKey(completed),minute=completed.getHours()*60+completed.getMinutes();if(completedKey===dateKey)duration=Math.max(0,minute-s);}
        else {const actual=parseClock(task.actualTime);if(actual!==null){const elapsed=crossesMidnight&&actual<12*60?actual+DAY_MINUTES-s:actual-s;duration=Math.max(0,Math.min(crossesMidnight?DAY_MINUTES-s:duration,elapsed));}}}
    }
    if(duration>0)occupied.push({start,end:Math.min(DAY_MINUTES,start+duration),index:task._priorDate?-1:current.indexOf(task)});
  }
  occupied.sort((a,b)=>a.start-b.start||a.end-b.end);
  const merged=[];for(const x of occupied){const last=merged.at(-1);if(last&&x.start<=last.end){last.end=Math.max(last.end,x.end);last.indices.push(x.index);}else merged.push({...x,indices:[x.index]});}
  let cursor=dayStart,afterIndex=dateKey===todayKey?freeTimeAnchorIndex(current,dateKey,dayStart):-1;const gaps=[];
  const add=(s,e)=>{if(e-s>=minGap)gaps.push({start:s===1440?'24:00':formatClock(s),end:e===1440?'24:00':formatClock(e),duration:e-s,date:dateKey,afterIndex,id:dateKey+'-gap-'+gaps.length});};
  for(const block of merged){if(block.end<=cursor){afterIndex=Math.max(afterIndex,...block.indices);continue;}if(block.start>=DAY_MINUTES)break;if(block.start>cursor)add(cursor,block.start);cursor=Math.max(cursor,block.end);afterIndex=Math.max(afterIndex,...block.indices);if(cursor>=DAY_MINUTES)break;}
  if(cursor<DAY_MINUTES)add(cursor,DAY_MINUTES);return gaps;
}
