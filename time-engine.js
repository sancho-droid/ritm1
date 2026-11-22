/** Ритм: pure time calculations, independent from DOM/CSS. */
export const DAY_MINUTES=1440, DAY_END_MINUTES=23*60;
export function parseClock(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))return null;const [,h,m]=value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);return Number(h)*60+Number(m)}
export function formatClock(minutes){const n=Math.max(0,Math.min(DAY_MINUTES-1,Math.round(minutes)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
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
export function conflicts(candidate,tasks){const start=parseClock(candidate?.time);if(start===null||candidate?.scheduleMode==='parallel')return[];const end=start+durationOf(candidate);return(tasks||[]).filter(t=>{if(t===candidate||t?.id===candidate?.id||t?.done||t?.scheduleMode==='parallel')return false;const otherStart=parseClock(t?.time);if(otherStart===null)return false;const otherEnd=otherStart+durationOf(t);return start<otherEnd&&otherStart<end})}
