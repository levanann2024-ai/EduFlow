const recentSearchLimit = 8;

export interface RecentSearch {
  query: string;
  searchedAt: string;
}

function storageKey(userId: string) {
  return `eduflow.profile.recent-searches:${encodeURIComponent(userId)}`;
}

export function readRecentSearches(userId: string): RecentSearch[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is RecentSearch => (
      typeof item === 'object'
      && item !== null
      && !Array.isArray(item)
      && typeof item.query === 'string'
      && typeof item.searchedAt === 'string'
      && !Number.isNaN(Date.parse(item.searchedAt))
    )).slice(0, recentSearchLimit);
  } catch {
    return [];
  }
}

export function recordRecentSearch(userId: string, query: string) {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ').slice(0, 160);
  if (!normalizedQuery) return;
  const searches = readRecentSearches(userId).filter(
    (item) => item.query.toLocaleLowerCase('vi') !== normalizedQuery.toLocaleLowerCase('vi'),
  );
  searches.unshift({ query: normalizedQuery, searchedAt: new Date().toISOString() });
  localStorage.setItem(storageKey(userId), JSON.stringify(searches.slice(0, recentSearchLimit)));
}
