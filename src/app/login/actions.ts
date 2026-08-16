"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { getLocale } from "@/lib/i18n/get-locale.server";
import { t } from "@/lib/i18n/translate";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t(await getLocale(), "auth.invalidCredentials") };
    }
    throw error;
  }
}
