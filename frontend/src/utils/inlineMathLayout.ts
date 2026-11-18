export function formatInlineMathLayout(latex: string) {
  const withLimits = latex.replace(/\\lim(?![a-zA-Z])(?=\s*[_^])/g, '\\lim\\limits');
  const hasFraction = /\\(?:d?frac|tfrac)\b/.test(withLimits);

  return hasFraction && !/^\s*\\displaystyle\b/.test(withLimits)
    ? `\\displaystyle ${withLimits}`
    : withLimits;
}
