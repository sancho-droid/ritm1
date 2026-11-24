import assert from 'node:assert/strict';
import { parseQuickTask } from './quick-add-parser.js';

const base = new Date(2026, 10, 24);
const now = new Date(2026, 10, 24, 9, 0);
const options = { now, categories: ['Личное','Работа','Здоровье','Дом','Семья','Покупки','Развитие'] };

for (const input of ['Тренировка 11.44-13.00', 'Тренировка 11.44 - 13.00', 'Тренировка 11:44–13:00']) {
  const result = parseQuickTask(input, base, options);
  assert.equal(result.time, '11:44', input);
  assert.equal(result.endTime, '13:00', input);
  assert.equal(result.duration, 76, input);
  assert.equal(result.name, 'Тренировка', input);
}
const dottedTime = parseQuickTask('Купить продукты в 13.10', base, options);
assert.equal(dottedTime.time, '13:10');
assert.equal(dottedTime.name, 'Купить продукты');
assert.equal(dottedTime.date, '2026-11-24');
assert.equal(dottedTime.ambiguity.date, '2026-10-13');
const dottedDate = parseQuickTask('Купить продукты 13.10', base, {...options, choice:'date'});
assert.equal(dottedDate.time, '');
assert.equal(dottedDate.date, '2026-10-13');
assert.equal(dottedDate.name, 'Купить продукты');
const explicitDate = parseQuickTask('Купить продукты 13.10.2026', base, options);
assert.equal(explicitDate.date, '2026-10-13');
assert.equal(explicitDate.time, '');
const textualDate = parseQuickTask('Встреча 13 октября 2026 в 13:10', base, options);
assert.equal(textualDate.date, '2026-10-13');
assert.equal(textualDate.time, '13:10');
const tomorrow = parseQuickTask('Завтра в 18:30 купить продукты', base, options);
assert.equal(tomorrow.date, '2026-11-25');
assert.equal(tomorrow.time, '18:30');
assert.equal(tomorrow.name, 'купить продукты');
console.log('quick-add parser: assertions passed');
