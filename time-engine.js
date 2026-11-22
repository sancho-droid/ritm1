/** Ритм: pure time calculations, independent from DOM/CSS. */
export const DAY_MINUTES=1440, DAY_START_MINUTES=0, DAY_END_MINUTES=23*60+59;
export function parseClock(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))return null;const [,h,m]=value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);return Number(h)*60+Number(m)}
export function formatClock(minutes){const n=Math.max(0,Math.min(DAY_MINUTES-1,Math.round(minutes)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
const DAY_START_NAMES=new Set(['подъём','подъем','проснуться','встать','пробуждение','утренний подъём','утренний подъем']);
const DAY_END_NAMES=new Set(['сон','отбой','лечь спать','ко сну','ночной сон']);
export function inferDayBoundary(name){
  const normalized=String(name||'').normalize('NFC').trim().toLocaleLowerCase('ru-RU').replace(/[.!?]+$/,'').replace(/\\s+/g,' ');
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
export function durationOf(task){const d=Number(task?.duration);if(Number.isFinite(d)&&d>0)return Math.round(d);const s=parseClock(task?.time),e=parseClock(task?.endTime);if(s!==null&&e!==null){let diff=e-s;if(diff<0)diff+=DAY_MINUTES;if(diff>0)return diff}return 1}
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
