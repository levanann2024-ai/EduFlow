import type { Role } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  adminScope?: 'system' | 'school' | null;
  schoolIds: string[];
  mustChangePassword: boolean;
  profileComplete: boolean;
  isDemo?: boolean;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  accessToken?: string;
  user?: AuthUser;
}

class AuthApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AuthApiError';
  }
}

let accessToken: string | null = null;
let demoSession = false;
let refreshRequest: Promise<AuthUser | null> | null = null;

function setSession(token: string | null, user?: AuthUser) {
  accessToken = token;
  demoSession = Boolean(user?.isDemo);
}

async function readResponse(response: Response): Promise<AuthResponse> {
  let body: AuthResponse;
  try {
    body = await response.json() as AuthResponse;
  } catch {
    throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  }
  if (!response.ok || !body.success) {
    throw new AuthApiError(body.message || 'Không thể hoàn tất yêu cầu.', response.status);
  }
  return body;
}

async function postAuth(path: string, body?: unknown): Promise<AuthResponse> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`/api/auth${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return readResponse(response);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await postAuth('/login', { email, password });
  if (!response.user || !response.accessToken) throw new Error('Phản hồi đăng nhập thiếu thông tin phiên.');
  setSession(response.accessToken, response.user);
  return response.user;
}

export async function demoLogin(role: Role): Promise<AuthUser> {
  const response = await postAuth('/demo', { role });
  if (!response.user || !response.accessToken) throw new Error('Không thể tạo phiên demo.');
  setSession(response.accessToken, response.user);
  return response.user;
}

export async function restoreSession(): Promise<AuthUser | null> {
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    try {
      const response = await postAuth('/refresh');
      if (!response.user || !response.accessToken) throw new Error('Phản hồi làm mới phiên thiếu thông tin.');
      setSession(response.accessToken, response.user);
      return response.user;
    } catch (error) {
      setSession(null);
      if (error instanceof AuthApiError && error.status === 401) return null;
      throw error;
    } finally {
      refreshRequest = null;
    }
  })();
  return refreshRequest;
}

export async function acceptInvitation(token: string, fullName: string, password: string): Promise<AuthUser> {
  const response = await postAuth('/invitations/accept', { token, fullName, password });
  if (!response.user || !response.accessToken) throw new Error('Phản hồi tạo tài khoản thiếu thông tin phiên.');
  setSession(response.accessToken, response.user);
  return response.user;
}

export interface RoleProfileInput {
  grade?: string;
  studentNumber?: string;
  employeeNumber?: string;
}

export async function completeProfile(fullName: string, roleProfile: RoleProfileInput = {}): Promise<AuthUser> {
  const response = await postAuth('/complete-profile', { fullName, ...roleProfile });
  if (!response.user) throw new Error('Phản hồi cập nhật hồ sơ thiếu thông tin tài khoản.');
  return response.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await postAuth('/change-password', { currentPassword, newPassword });
}

export async function logout(): Promise<void> {
  try {
    if (accessToken) await postAuth('/logout');
  } finally {
    setSession(null);
  }
}

async function refreshForRequest(): Promise<boolean> {
  if (demoSession) return false;
  try {
    return Boolean(await restoreSession());
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return false;
    throw error;
  }
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const makeRequest = () => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    return fetch(input, { ...init, headers, credentials: 'include' });
  };

  let response = await makeRequest();
  if (response.status === 401 && accessToken && await refreshForRequest()) {
    response = await makeRequest();
  }
  return response;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await authenticatedFetch('/api/auth/me', { method: 'GET' });
  const body = await readResponse(response);
  if (!body.user) throw new Error('Phản hồi tài khoản thiếu thông tin người dùng.');
  return body.user;
}
