'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
    ADMIN_COOKIE,
    createSessionValue,
    passwordMatches,
    sessionCookieOptions,
} from '@/lib/server/admin-auth';

/** Wrong guesses wait a moment, so the form can't be hammered quickly. */
const FAILED_DELAY_MS = 900;

export interface LoginState {
    error: string | null;
    /** Bumps on every failure, so the form can replay its shake. */
    attempt: number;
}

export async function login(
    previous: LoginState,
    formData: FormData,
): Promise<LoginState> {
    const attempt = String(formData.get('password') ?? '');

    if (!attempt) {
        return { error: 'Enter your password.', attempt: previous.attempt + 1 };
    }

    if (!passwordMatches(attempt)) {
        await new Promise((resolve) => setTimeout(resolve, FAILED_DELAY_MS));
        return {
            error: 'That password is not right.',
            attempt: previous.attempt + 1,
        };
    }

    (await cookies()).set(ADMIN_COOKIE, createSessionValue(), sessionCookieOptions);
    redirect('/admin');
}

export async function logout() {
    (await cookies()).delete(ADMIN_COOKIE);
    redirect('/admin');
}
