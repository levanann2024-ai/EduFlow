const assert = require('node:assert/strict');
const { test } = require('node:test');
const { hasValidSchoolScope } = require('./school-scope');

test('students and lecturers require exactly one active school', () => {
  for (const role of ['student', 'lecturer']) {
    assert.equal(hasValidSchoolScope({ role, schoolIds: [] }), false);
    assert.equal(hasValidSchoolScope({ role, schoolIds: ['school-a'] }), true);
    assert.equal(hasValidSchoolScope({ role, schoolIds: ['school-a', 'school-b'] }), false);
  }
});

test('school administrators need a school while system administrators may be global', () => {
  assert.equal(hasValidSchoolScope({ role: 'admin', adminScope: 'school', schoolIds: [] }), false);
  assert.equal(hasValidSchoolScope({ role: 'admin', adminScope: 'school', schoolIds: ['school-a', 'school-b'] }), true);
  assert.equal(hasValidSchoolScope({ role: 'admin', adminScope: 'system', schoolIds: [] }), true);
});
