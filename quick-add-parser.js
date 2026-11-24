const pad = value => String(value).padStart(2, '0');
const dateKey = date => date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
const addDays = (date, amount) => { const next = new Date(date.getFullYear(), date.getMonth(), date.getDate()); next.setDate(next.getDate()+amount); return next; };
const validDate = (year, month, day) => { const date = new Date(year, month, day); return date.getFullYear()===year && date.getMonth()===month && date.getDate()===day ? date : null; };
const validClock = (hour, minute) => hour>=0 && hour<=23 && minute>=0 && minute<=59;
const clock = (hour, minute) => pad(hour)+':'+pad(minute);
const durationBetween = (start, end) => (end-start+1440)%1440;

const monthNames = [['января','январь','янв'],['февраля','февраль','фев'],['марта','март','мар'],['апреля','апрель','апр'],['мая','май'],['июня','июнь','июн'],['июля','июль','июл'],['августа','август','авг'],['сентября','сентябрь','сен','сент'],['октября','октябрь','окт'],['ноября','ноябрь','ноя'],['декабря','декабрь','дек']];
const monthPattern = monthNames.map(forms => forms.join('|')).join('|');

export function parseQuickTask(input, baseDate = new Date(), options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const categories = Array.isArray(options.categories) ? options.categories : [];
  const choice = options.choice || 'time';
  const original = String(input || '').trim().replace(/\s+/g, ' ');
  let clean = original;
  if (!clean) return null;

  let target = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  let time = '', endTime = '', duration = 0, repeat = null, ambiguity = null;
  const weekdays = {'воскресенье':0,'понедельник':1,'вторник':2,'среду':3,'среда':3,'четверг':4,'пятницу':5,'пятница':5,'субботу':6,'суббота':6};

  if (/каждый день|каждое утро|ежедневно/i.test(clean)) { repeat={type:'daily'}; clean=clean.replace(/каждый день|каждое утро|ежедневно/ig,' '); }
  else if (/по будням/i.test(clean)) { repeat={type:'weekly',weekdays:[1,2,3,4,5]}; clean=clean.replace(/по будням/ig,' '); }
  else {
    const rm=clean.match(/кажд(?:ый|ую|ое)\s+(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)/i);
    if(rm){repeat={type:'weekly',weekdays:[weekdays[rm[1].toLocaleLowerCase('ru-RU')]]};clean=clean.replace(rm[0],' ');}
  }

  const relative=clean.match(/через\s+(\d+)\s*(дн(?:я|ей)?|час(?:а|ов)?|минут(?:у|ы)?)/i);
  if(relative){
    const count=Number(relative[1]),unit=relative[2].toLocaleLowerCase('ru-RU');let date=new Date(now);
    if(unit.startsWith('дн')){date.setDate(date.getDate()+count);target=new Date(date.getFullYear(),date.getMonth(),date.getDate());}
    else{date=new Date(date.getTime()+count*(unit.startsWith('час')?3600000:60000));target=new Date(date.getFullYear(),date.getMonth(),date.getDate());time=clock(date.getHours(),date.getMinutes());}
    clean=clean.replace(relative[0],' ');
  }

  const textualDate=clean.match(new RegExp('\\b(\\d{1,2})\\s+('+monthPattern+')\\.?\\s*(\\d{4})?(?=\\s|$)','i'));
  if(textualDate){
    const monthIndex=monthNames.findIndex(forms=>forms.includes(textualDate[2].toLocaleLowerCase('ru-RU')));
    const day=Number(textualDate[1]),year=Number(textualDate[3]||target.getFullYear()),date=validDate(year,monthIndex,day);
    if(monthIndex>=0&&date)target=date;
    clean=clean.replace(textualDate[0],' ');
  }

  const range=clean.match(/(?:^|\s)(?:с\s*)?(\d{1,2})[.:](\d{2})\s*(?:-|–|—|до|по)\s*(\d{1,2})[.:](\d{2})(?=\s|$)/i);
  if(range){
    const sh=Number(range[1]),sm=Number(range[2]),eh=Number(range[3]),em=Number(range[4]);
    if(validClock(sh,sm)&&validClock(eh,em)){time=clock(sh,sm);endTime=clock(eh,em);duration=durationBetween(sh*60+sm,eh*60+em);clean=clean.replace(range[0],' ');}
  }

  const explicitDate=clean.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?=\s|$)/);
  if(explicitDate){
    let year=Number(explicitDate[3]);if(year<100)year+=2000;
    const month=Number(explicitDate[2])-1,day=Number(explicitDate[1]),date=validDate(year,month,day);
    if(date){target=date;clean=clean.replace(explicitDate[0],' ');}
  } else if(!time) {
    const ambiguous=clean.match(/(?:^|\s)(\d{1,2})\.(\d{2})(?=\s|$)/);
    if(ambiguous){
      const hour=Number(ambiguous[1]),minute=Number(ambiguous[2]);
      const date=validDate(target.getFullYear(),minute-1,hour);
      if(validClock(hour,minute)&&date){
        ambiguity={token:ambiguous[0].trim(),time:clock(hour,minute),date:dateKey(date)};
        if(choice==='date'){target=date;clean=clean.replace(ambiguous[0],' ');}
        else{time=clock(hour,minute);clean=clean.replace(ambiguous[0],' ');}
      } else if(validClock(hour,minute)){time=clock(hour,minute);clean=clean.replace(ambiguous[0],' ');}
    }
    if(!ambiguity){
      const numericDate=clean.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/);
      if(numericDate){const date=validDate(target.getFullYear(),Number(numericDate[2])-1,Number(numericDate[1]));if(date){target=date;clean=clean.replace(numericDate[0],' ');}}
    }
  }

  if(/(?:^|\s)послезавтра(?:\s|$)/i.test(clean)){target=addDays(new Date(now.getFullYear(),now.getMonth(),now.getDate()),2);clean=clean.replace(/послезавтра/ig,' ');}
  else if(/(?:^|\s)завтра(?:\s|$)/i.test(clean)){target=addDays(new Date(now.getFullYear(),now.getMonth(),now.getDate()),1);clean=clean.replace(/завтра/ig,' ');}
  else if(/(?:^|\s)сегодня(?:\s|$)/i.test(clean)){target=new Date(now.getFullYear(),now.getMonth(),now.getDate());clean=clean.replace(/сегодня/ig,' ');}

  const weekday=clean.match(/(?:^|\s)(?:в\s+)?(понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?=\s|$)/i);
  if(weekday){const wanted=weekdays[weekday[1].toLocaleLowerCase('ru-RU')],base=new Date(now.getFullYear(),now.getMonth(),now.getDate()),delta=(wanted-base.getDay()+7)%7;target=addDays(base,delta||7);clean=clean.replace(weekday[0],' ');}

  if(!time){
    const explicitClock=clean.match(/(?:^|\s)(?:в\s*)?(\d{1,2}):(\d{2})(?:\s*(утра|дня|вечера|ночи))?(?=\s|$)/i);
    if(explicitClock){
      let hour=Number(explicitClock[1]),minute=Number(explicitClock[2]),period=(explicitClock[3]||'').toLocaleLowerCase('ru-RU');
      if((period==='вечера'||period==='дня')&&hour<12)hour+=12;if(period==='ночи'&&hour===12)hour=0;
      if(validClock(hour,minute)){time=clock(hour,minute);clean=clean.replace(explicitClock[0],' ');}
    }
  }
  if(!time){
    const dottedClock=clean.match(/(?:^|\s)(?:в\s*)?(\d{1,2})\.(\d{2})(?:\s*(утра|дня|вечера|ночи))?(?=\s|$)/i);
    if(dottedClock){const hour=Number(dottedClock[1]),minute=Number(dottedClock[2]);if(validClock(hour,minute)){time=clock(hour,minute);clean=clean.replace(dottedClock[0],' ');}}
  }

  const half=clean.match(/(?:^|\s)полчаса(?=\s|$)/i);if(half){duration=30;clean=clean.replace(half[0],' ');}
  const oneHour=clean.match(/(?:^|\s)на\s+час(?=\s|$)/i);if(oneHour){duration=60;clean=clean.replace(oneHour[0],' ');}
  const durationMatch=clean.match(/(?:^|\s)на\s*(?:(\d+)\s*ч(?:ас(?:а|ов)?)?)?(?:\s*(\d+)\s*мин(?:ут(?:у|ы)?)?)?(?=\s|$)/i);
  if(durationMatch&&(durationMatch[1]||durationMatch[2])){duration=Number(durationMatch[1]||0)*60+Number(durationMatch[2]||0);clean=clean.replace(durationMatch[0],' ');}
  else{
    const hours=clean.match(/(?:^|\s)(\d+)\s*ч(?:ас(?:а|ов)?)?(?:\s*(\d+)\s*мин(?:ут(?:у|ы)?)?)?(?=\s|$)/i);
    const minutes=clean.match(/(?:^|\s)(\d+)\s*мин(?:ут(?:у|ы)?)?(?=\s|$)/i);
    if(hours){duration=Number(hours[1])*60+Number(hours[2]||0);clean=clean.replace(hours[0],' ');}
    else if(minutes){duration=Number(minutes[1]);clean=clean.replace(minutes[0],' ');}
  }
  if(time&&duration&&!endTime){const total=(Number(time.slice(0,2))*60+Number(time.slice(3))+duration)%1440;endTime=clock(Math.floor(total/60),total%60);}

  clean=clean.replace(/(?:^|\s)(в|на|к|до|с)\s*$/i,'').replace(/\s+/g,' ').replace(/^[\s,.;:]+|[\s,.;:]+$/g,'').trim();
  if(!clean)clean=original;
  const lower=clean.toLocaleLowerCase('ru-RU');let category='Личное';
  const guesses=[['Работа',/работ|совещан|отч[её]т|коллег|репетиц|концерт/],['Здоровье',/врач|терапевт|анализ|трениров|зарядк|турник|спорт|бег/],['Дом',/убрать|почин|помыть|стир|дом|заказать фильтр/],['Семья',/лукер|реб[её]н|доч|садик|танц|семь/],['Покупки',/купить|магазин|продукт|заказать|покуп/],['Развитие',/читать|книга|учить|курс|изучить/]];
  for(const [name,pattern] of guesses){if(pattern.test(lower)&&categories.includes(name)){category=name;break;}}
  return {name:clean.slice(0,100),date:dateKey(target),time,duration,endTime:duration?endTime:'',category,repeat,ambiguity};
}
