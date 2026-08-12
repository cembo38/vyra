import "server-only";
import { cookies } from "next/headers";
import { DEMO_USER_ID, getUser, getOrCreateUser } from "@/lib/data/store";
import { UserAccount } from "@/lib/types";

const COOKIE_NAME = "ef_uid";

/**
 * Mock-authenticatie voor deze demo. In productie vervang je dit door
 * Supabase Auth (of vergelijkbaar) met echte sessies/JWT's — de rest van de
 * applicatie roept alleen `getCurrentUser()` aan en hoeft dan niet te
 * wijzigen.
 *
 * Zonder ingelogde sessie vallen we terug op de demo-gebruiker, zodat het
 * platform vanaf de eerste klik te ervaren is.
 */
export async function getCurrentUser(): Promise<UserAccount> {
  const store = await cookies();
  const uid = store.get(COOKIE_NAME)?.value ?? DEMO_USER_ID;
  return getUser(uid) ?? getUser(DEMO_USER_ID)!;
}

export async function setCurrentUserCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function loginOrSignup(email: string, extra?: Partial<UserAccount>) {
  const user = getOrCreateUser(email, extra);
  await setCurrentUserCookie(user.id);
  return user;
}
