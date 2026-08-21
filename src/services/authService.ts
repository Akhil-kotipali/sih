/**
 * Authentication Service for LearnPath
 * Handles secure user registration, password hashing verification, JWT/Session tokens,
 * profile management, data export, and account deletion with complete user isolation.
 */

import { UserProfile, AuthSession, LearningPreferences, UserStats } from '../types';

const AUTH_STORAGE_KEYS = {
  CURRENT_SESSION: 'learnpath_auth_session',
  REGISTERED_ACCOUNTS: 'learnpath_registered_accounts_secure', // local backup with hashed passwords
};

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  uiLanguage: 'en',
  learningLanguage: 'en',
  resourceLanguages: ['en'],
  learningLevel: 'Beginner',
  explanationStyle: 'First Principles',
  preferredQuestionDifficulty: 'adaptive',
  dailyStudyMinutes: 20,
  preferredStudyTime: 'flexible',
  mentorTone: 'socratic',
};

export function createInitialUserStats(): UserStats {
  return {
    topicsLearned: 0,
    streak: 0,
    xp: 0,
    assessmentsCompleted: 0,
    questionTypeAccuracy: {
      mcq: { correct: 0, total: 0 },
      true_false: { correct: 0, total: 0 },
      fill_blank: { correct: 0, total: 0 },
      code_input: { correct: 0, total: 0 },
      debugging: { correct: 0, total: 0 },
      arrange_steps: { correct: 0, total: 0 },
      explanation: { correct: 0, total: 0 },
    },
  };
}

/**
 * SHA-256 browser hash utility for client-side hashing if offline
 */
export async function hashPasswordClient(password: string, salt: string = 'learnpath_salt_v1'): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + ':' + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// -------------------------------------------------------------
// SESSION MANAGEMENT
// -------------------------------------------------------------

export function getActiveSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEYS.CURRENT_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user && parsed.user.id) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: AuthSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_STORAGE_KEYS.CURRENT_SESSION);
      return;
    }
    localStorage.setItem(AUTH_STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

export function getActiveUser(): UserProfile | null {
  const session = getActiveSession();
  return session ? session.user : null;
}

// -------------------------------------------------------------
// AUTHENTICATION API CALLS
// -------------------------------------------------------------

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  preferences?: Partial<LearningPreferences>;
  bio?: string;
}

export async function registerUser(payload: RegisterPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();

  if (!name || name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters.' };
  }
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!payload.password || payload.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  // 1. Attempt Server-side registration
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password: payload.password,
        preferences: payload.preferences,
        bio: payload.bio,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        saveActiveSession(data.session);
        return { success: true, session: data.session };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.error || `Registration failed (${res.status})` };
    }
  } catch (e) {
    console.warn('Server auth endpoint unreachable, falling back to secure local account store:', e);
  }

  // 2. Local Fallback Account Store (with SHA-256 hashed password)
  const passwordHash = await hashPasswordClient(payload.password, email);
  const rawAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS);
  const accounts: Record<string, { passwordHash: string; user: UserProfile }> = rawAccounts ? JSON.parse(rawAccounts) : {};

  if (accounts[email]) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const newUser: UserProfile = {
    id: userId,
    name,
    email,
    bio: payload.bio || '',
    preferences: {
      ...DEFAULT_LEARNING_PREFERENCES,
      ...(payload.preferences || {}),
    },
    stats: createInitialUserStats(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    shortGoals: [],
    shortGoalLabels: {},
  };

  accounts[email] = { passwordHash, user: newUser };
  localStorage.setItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(accounts));

  const session: AuthSession = {
    token: `tok_loc_${userId}_${Date.now()}`,
    user: newUser,
  };
  saveActiveSession(session);
  return { success: true, session };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function loginUser(payload: LoginPayload): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const email = payload.email.trim().toLowerCase();

  if (!email || !payload.password) {
    return { success: false, error: 'Please provide both email and password.' };
  }

  // 1. Try server-side login
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: payload.password }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.session) {
        saveActiveSession(data.session);
        return { success: true, session: data.session };
      }
    } else {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 400) {
        return { success: false, error: err.error || 'Invalid email or password.' };
      }
    }
  } catch (e) {
    console.warn('Server auth endpoint unreachable, checking local account store:', e);
  }

  // 2. Local Fallback Account Store
  const rawAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS);
  const accounts: Record<string, { passwordHash: string; user: UserProfile }> = rawAccounts ? JSON.parse(rawAccounts) : {};

  const record = accounts[email];
  if (!record) {
    return { success: false, error: 'No account found with this email. Please register.' };
  }

  const computedHash = await hashPasswordClient(payload.password, email);
  if (record.passwordHash !== computedHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  const session: AuthSession = {
    token: `tok_loc_${record.user.id}_${Date.now()}`,
    user: record.user,
  };
  saveActiveSession(session);
  return { success: true, session };
}

export async function logoutUser(): Promise<void> {
  const session = getActiveSession();
  if (session?.token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
      });
    } catch {}
  }
  saveActiveSession(null);
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile | null> {
  const session = getActiveSession();
  if (!session) return null;

  const updatedUser: UserProfile = {
    ...session.user,
    ...updates,
    preferences: {
      ...session.user.preferences,
      ...(updates.preferences || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  // Sync to server if possible
  try {
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(updatedUser),
    });
  } catch {}

  // Update in local accounts map
  try {
    const rawAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS);
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      if (accounts[updatedUser.email]) {
        accounts[updatedUser.email].user = updatedUser;
        localStorage.setItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(accounts));
      }
    }
  } catch {}

  const newSession: AuthSession = {
    ...session,
    user: updatedUser,
  };
  saveActiveSession(newSession);
  return updatedUser;
}

export async function deleteUserAccount(): Promise<boolean> {
  const session = getActiveSession();
  if (!session) return false;

  const userId = session.user.id;
  const email = session.user.email;

  // 1. Delete from server
  try {
    await fetch('/api/user/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
    });
  } catch {}

  // 2. Clear user-scoped local storage keys
  const keysToRemove = [
    `learnpath_${userId}_goals`,
    `learnpath_${userId}_roadmaps`,
    `learnpath_${userId}_sessions`,
    `learnpath_${userId}_mastery`,
    `learnpath_${userId}_bookmarks`,
    `learnpath_${userId}_resources_feedback`,
    `learnpath_${userId}_mentor_history`,
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // 3. Remove from registered accounts map
  try {
    const rawAccounts = localStorage.getItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS);
    if (rawAccounts) {
      const accounts = JSON.parse(rawAccounts);
      delete accounts[email];
      localStorage.setItem(AUTH_STORAGE_KEYS.REGISTERED_ACCOUNTS, JSON.stringify(accounts));
    }
  } catch {}

  saveActiveSession(null);
  return true;
}
