import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const name of ['checkout_session_completed','checkout_session_missing_optional']){
 const o=JSON.parse(readFileSync(new URL(`../FIXTURES/${name}.json`,import.meta.url),'utf8'));
 assert.equal(o.type,'checkout.session.completed');assert.ok(o.id&&o.data.object.id);assert.equal(typeof o.data.object.amount_total,'number');
}
const schema=JSON.parse(readFileSync(new URL('../SCHEMAS/internal_event.schema.json',import.meta.url),'utf8'));
assert.equal(schema.required.length,9);
console.log('Source fixtures and required schema keys verified');
