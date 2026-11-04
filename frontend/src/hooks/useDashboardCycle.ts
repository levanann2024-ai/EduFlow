import { useEffect, useState } from 'react';

const CYCLE_INTERVAL_MS = 5_000;

export function useDashboardCycle(
  itemCount: number,
  pageSize: number,
  staggerMs: number,
  resetKey?: string,
) {
  const pageCount = Math.ceil(itemCount / pageSize);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setPage(0);
  }, [pageCount, resetKey]);

  useEffect(() => {
    if (pageCount <= 1 || paused) return undefined;

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      setPage((current) => (current + 1) % pageCount);
      intervalId = window.setInterval(() => {
        setPage((current) => (current + 1) % pageCount);
      }, CYCLE_INTERVAL_MS);
    }, CYCLE_INTERVAL_MS + staggerMs);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [pageCount, paused, staggerMs]);

  return { page, pageCount, setPaused };
}
