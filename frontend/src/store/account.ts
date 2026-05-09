import {
  apiLogin,
  apiRegister,
  apiLogout,
  apiMe,
  type AuthResponse,
} from "@/src/api/komikamApi";
import {
  saveToken,
  clearToken,
  saveUser,
  getSavedUser,
  type ApiUser,
} from "@/src/store/authToken";

export type AccountProfile = ApiUser;

export async function getProfile(): Promise<AccountProfile | null> {
  return getSavedUser();
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AccountProfile> {
  const res: AuthResponse = await apiRegister(input);
  await saveToken(res.token);
  await saveUser(res.user);
  return res.user;
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<AccountProfile> {
  const res: AuthResponse = await apiLogin(input);
  await saveToken(res.token);
  await saveUser(res.user);
  return res.user;
}

export async function signOut(): Promise<void> {
  try {
    await apiLogout();
  } catch {
    // token mungkin sudah expired, lanjut hapus lokal
  }
  await clearToken();
}

export async function refreshProfile(): Promise<AccountProfile | null> {
  try {
    const user = await apiMe();
    await saveUser(user);
    return user;
  } catch {
    return null;
  }
}
