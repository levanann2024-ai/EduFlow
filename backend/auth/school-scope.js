function hasValidSchoolScope(user) {
  if (!Array.isArray(user.schoolIds)) return user.role === 'admin' && user.adminScope !== 'school';
  if (user.role === 'student' || user.role === 'lecturer') {
    return user.schoolIds.length === 1;
  }
  return user.role === 'admin'
    && (user.adminScope !== 'school' || user.schoolIds.length > 0);
}

module.exports = { hasValidSchoolScope };
