import { api, ApiError } from '@/lib/api';
import type { User, LoginCredentials, SignupCredentials } from '@/types';

type Result = { success: boolean; user?: User; error?: string };

async function call(path: string, json: unknown): Promise<Result> {
  try {
    const { user } = await api<{ user: User }>(path, { method: 'POST', json });
    return { success: true, user };
  } catch (err) {
    return { success: false, error: err instanceof ApiError ? err.message : 'Unexpected error. Please try again.' };
  }
}

export const AuthService = {
  /** Resolves the signed-in user from the server session cookie, or null. */
  async fetchCurrentUser(): Promise<User | null> {
    try {
      const { user } = await api<{ user: User }>('/auth/me');
      return user;
    } catch {
      return null;
    }
  },

  login(credentials: LoginCredentials): Promise<Result> {
    return call('/auth/login', {
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe ?? true,
    });
  },

  signup(credentials: SignupCredentials): Promise<Result> {
    if (credentials.password !== credentials.confirmPassword) {
      return Promise.resolve({ success: false, error: 'Passwords do not match. Please re-enter to confirm.' });
    }
    return call('/auth/signup', {
      name: credentials.name,
      email: credentials.email,
      organization: credentials.organization || undefined,
      password: credentials.password,
    });
  },

  async logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* session cookie is cleared server-side on next request anyway */
    }
  },

  async updateProfile(data: { name?: string; organization?: string }): Promise<Result> {
    try {
      const { user } = await api<{ user: User }>('/auth/profile', { method: 'PATCH', json: data });
      return { success: true, user };
    } catch (err) {
      return { success: false, error: err instanceof ApiError ? err.message : 'Failed to update profile.' };
    }
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; error?: string }> {
    try {
      await api('/auth/change-password', { method: 'POST', json: data });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof ApiError ? err.message : 'Failed to change password.' };
    }
  },
};
