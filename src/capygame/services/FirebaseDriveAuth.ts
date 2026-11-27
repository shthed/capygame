import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
  type Unsubscribe,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'] as const;

export interface FirebaseDriveUserProfile {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let isSigningIn = false;
// Strict in-memory access token cache (NEVER persisted to localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

function sanitizeAvatarUrl(raw: string | null | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Reject malformed URLs
  }
  return undefined;
}

function mapFirebaseUser(user: User): FirebaseDriveUserProfile {
  return {
    id: user.uid,
    displayName: user.displayName || user.email || 'Google Account',
    email: user.email ?? undefined,
    avatarUrl: sanitizeAvatarUrl(user.photoURL),
  };
}

function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const existingApps = getApps();
  cachedApp = existingApps.length > 0 ? existingApps[0] : initializeApp(firebaseConfig);
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
}

function buildGoogleDriveProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of DRIVE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function initFirebaseDriveAuth(
  onAuthSuccess?: (profile: FirebaseDriveUserProfile, token: string) => void,
  onAuthFailure?: () => void
): Unsubscribe {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(mapFirebaseUser(user), cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
}

export async function signInWithFirebaseGoogleDrive(): Promise<{
  profile: FirebaseDriveUserProfile;
  accessToken: string;
}> {
  const auth = getFirebaseAuth();
  const provider = buildGoogleDriveProvider();
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Sign-In did not return a Google Drive access token.');
    }
    cachedAccessToken = credential.accessToken;
    return {
      profile: mapFirebaseUser(result.user),
      accessToken: cachedAccessToken,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('Google Sign-In popup was closed before completing.');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Google Sign-In popup was blocked by your browser. Please allow popups and try again.');
    }
    throw err instanceof Error ? err : new Error('Google Sign-In failed.');
  } finally {
    isSigningIn = false;
  }
}

export function getCachedFirebaseAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedFirebaseAccessToken(): void {
  cachedAccessToken = null;
}

export async function signOutFirebaseDrive(): Promise<void> {
  cachedAccessToken = null;
  const auth = getFirebaseAuth();
  await auth.signOut();
}
