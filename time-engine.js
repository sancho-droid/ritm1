/** Ритм: pure time calculations, independent from DOM/CSS. */
export const DAY_MINUTES=1440, DAY_END_MINUTES=23*60;
export function parseClock(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value))return null;const [,h,m]=value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);return Number(h)*60+Number(m)}
export function formatClock(minutes){const n=Math.max(0,Math.min(DAY_MINUTES-1,Math.round(minutes)));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
export function durationOf(task){const d=Number(task?.duration);if(Number.isFinite(d)&&d>0)return Math.round(d);const s=parseClock(task?.time),e=parseClock(task?.endTime);if(s!==null&&e!==null){let diff=e-s;if(diff<0)diff+=DAY_MINUTES;if(diff>0)return diff}return 1}
export function sortChronologically(tasks){return [...tasks].sort((a,b)=>{const am=parseClock(a?.time),bm=parseClock(b?.time);if(am===null&&bm===null)return 0;if(am===null)return 1;if(bm===null)return-1;return am-bm})}
export function intervalsFor(tasks,{includeCompleted=false,dayEnd=DAY_END_MINUTES}={}){const list=[];for(const task of tasks||[]){const start=parseClock(task?.time);if(start===null||task?.scheduleMode==='parallel'||(!includeCompleted&&task?.done))continue;const end=Math.min(dayEnd,start+durationOf(task));if(end>start)list.push({start,end,task})}list.sort((a,b)=>a.start-b.start||a.end-b.end);const merged=[];for(const item of list){const last=merged.at(-1);if(last&&item.start<last.end){last.end=Math.max(last.end,item.end);last.tasks.push(item.task)}else merged.push({start:item.start,end:item.end,tasks:[item.task]})}return merged}
export function freeIntervals(tasks,{nowMinutes=null,dayEnd=DAY_END_MINUTES,minGap=15}={}){const occupied=intervalsFor(tasks,{dayEnd});const gaps=[];let cursor=Math.max(0,nowMinutes??0);for(const block of occupied){if(block.end<=cursor)continue;if(block.start-cursor>=minGap)gaps.push({start:cursor,end:block.start,duration:block.start-cursor});cursor=Math.max(cursor,block.end)}if(dayEnd-cursor>=minGap)gaps.push({start:cursor,end:dayEnd,duration:dayEnd-cursor});return gaps}
export function conflicts(candidate,tasks){const start=parseClock(candidate?.time);if(start===null||candidate?.scheduleMode==='parallel')return[];const end=start+durationOf(candidate);return(tasks||[]).filter(t=>{if(t===candidate||t?.id===candidate?.id||t?.done||t?.scheduleMode==='parallel')return false;const otherStart=parseClock(t?.time);if(otherStart===null)return false;const otherEnd=otherStart+durationOf(t);return start<otherEnd&&otherStart<end})}
export function minuteToY(minute,{originMinute=0,pixelsPerMinute=1}={}){return(minute-originMinute)*pixelsPerMinute}
export function yToMinute(y,{originMinute=0,pixelsPerMinute=1,step=5,min=0,max=1439}={}){if(!(pixelsPerMinute>0))throw new Error('pixelsPerMinute must be positive');const raw=originMinute+y/pixelsPerMinute,rounded=Math.round(raw/step)*step;return Math.max(min,Math.min(max,rounded))}


/** Build an invertible screen/time scale from task edges and hourly anchors. */
export function createTimelineAnchors(cardAnchors, {
  originMinute = 480, originY = 0, pixelsPerMinute = 69 / 60,
  minMinute = 0, maxMinute = DAY_MINUTES
} = {}) {
  const candidates = (cardAnchors || [])
    .filter(a => Number.isFinite(a?.minutes) && Number.isFinite(a?.y))
    .map(a => ({...a, minutes:Math.max(minMinute,Math.min(maxMinute,a.minutes)),
      priority:Number.isFinite(a.priority)?a.priority:(a.kind==='start'?2:1)}))
    .sort((a,b)=>a.y-b.y||b.priority-a.priority);
  const base=[];
  for(const anchor of candidates){
    while(base.length&&anchor.minutes<=base[base.length-1].minutes&&anchor.priority>base[base.length-1].priority)base.pop();
    const last=base[base.length-1];
    if(!last||(anchor.minutes>last.minutes&&anchor.y>last.y))base.push(anchor);
  }
  const interpolate=(value,anchors)=>{
    if(!anchors.length)return originY+(value-originMinute)*pixelsPerMinute;
    if(anchors.length===1)return anchors[0].y+(value-anchors[0].minutes)*pixelsPerMinute;
    let left=anchors[0],right=anchors[1];
    if(value>=anchors[anchors.length-1].minutes){left=anchors[anchors.length-2];right=anchors[anchors.length-1]}
    else for(let i=0;i<anchors.length-1;i++)if(value>=anchors[i].minutes&&value<=anchors[i+1].minutes){left=anchors[i];right=anchors[i+1];break}
    const span=right.minutes-left.minutes;
    return span>0?left.y+(value-left.minutes)*(right.y-left.y)/span:left.y;
  };
  const result=[...base];
  for(let minute=minMinute;minute<=maxMinute;minute+=60){
    if(!base.some(a=>a.minutes===minute))result.push({minutes:minute,y:interpolate(minute,base),kind:'hour',priority:0});
  }
  if(maxMinute%60!==0&&!result.some(a=>a.minutes===maxMinute))result.push({minutes:maxMinute,y:interpolate(maxMinute,base),kind:'hour',priority:0});
  return result.sort((a,b)=>a.minutes-b.minutes||b.priority-a.priority);
}
function interpolateTimeline(value,anchors,fromKey,toKey,fallbackSlope,fallbackOrigin){
  if(!Number.isFinite(value))return fallbackOrigin;
  if(!anchors?.length)return fallbackOrigin+value*fallbackSlope;
  if(anchors.length===1)return anchors[0][toKey]+(value-anchors[0][fromKey])*fallbackSlope;
  let left=anchors[0],right=anchors[1];
  if(value>=anchors[anchors.length-1][fromKey]){left=anchors[anchors.length-2];right=anchors[anchors.length-1]}
  else for(let i=0;i<anchors.length-1;i++)if(value>=anchors[i][fromKey]&&value<=anchors[i+1][fromKey]){left=anchors[i];right=anchors[i+1];break}
  const span=right[fromKey]-left[fromKey];
  return span>0?left[toKey]+(value-left[fromKey])*(right[toKey]-left[toKey])/span:left[toKey]+(value-left[fromKey])*fallbackSlope;
}
export function timelineMinutesAtY(y,anchors,{fallbackMinutes=480,fallbackY=0,pixelsPerMinute=69/60}={}){
  const minutes=interpolateTimeline(y,anchors,'y','minutes',1/pixelsPerMinute,fallbackMinutes-fallbackY/pixelsPerMinute);
  return Math.max(0,Math.min(DAY_MINUTES-1,minutes));
}
export function timelineYAtMinutes(minutes,anchors,{fallbackMinutes=480,fallbackY=0,pixelsPerMinute=69/60}={}){
  return interpolateTimeline(minutes,anchors,'minutes','y',pixelsPerMinute,fallbackY-fallbackMinutes*pixelsPerMinute);
}
