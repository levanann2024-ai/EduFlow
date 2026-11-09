import { useCallback, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/auth/authApi';

interface ApiErrorBody {
  message?: string;
}

export async function fetchAdminApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(`/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  let body: Record<string, unknown>;
  try {
    body = await response.json() as Record<string, unknown>;
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }
  if (!response.ok) {
    throw new Error((body as ApiErrorBody).message || 'Không thể tải dữ liệu quản trị.');
  }
  return body as T;
}

export function useAdminResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError('');
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    fetchAdminApi<T>(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải dữ liệu quản trị.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, reloadToken]);

  return { data, loading, error, reload };
}
