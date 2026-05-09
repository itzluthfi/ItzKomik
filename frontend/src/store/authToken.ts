import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "komikam:api_token:v1";
const USER_KEY  = "komikam:api_user:v1";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export async function saveToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function saveUser(user: ApiUser): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getSavedUser(): Promise<ApiUser | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}
