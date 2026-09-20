import test from 'node:test';
import assert from 'node:assert/strict';
import { upsertJobs } from '../scripts/jobsTracker.js';

test('upsertJobs adds new jobs with status and addedAt', () => {
  const out = upsertJobs([], [{ id: 'a', title: 'X' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'new');
  assert.ok(!Number.isNaN(Date.parse(out[0].addedAt)));
});

test('upsertJobs never overwrites an existing job (keeps user status)', () => {
  const existing = [{ id: 'a', title: 'Old', status: 'applied' }];
  const out = upsertJobs(existing, [{ id: 'a', title: 'New' }, { id: 'b', title: 'B' }]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], existing[0]);
  assert.equal(out[1].id, 'b');
});

test('upsertJobs does not mutate its input', () => {
  const existing = [{ id: 'a' }];
  upsertJobs(existing, [{ id: 'b' }]);
  assert.equal(existing.length, 1);
});
