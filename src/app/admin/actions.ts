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

export async function login(formData: FormData) {
    const attempt = String(formData.get('password') ?? '');

    if (!passwordMatches(attempt)) {
        await new Promise((resolve) => setTimeout(resolve, FAILED_DELAY_MS));
        redirect('/admin?error=1');
    }

    (await cookies()).set(ADMIN_COOKIE, createSessionValue(), sessionCookieOptions);
    redirect('/admin');
}

export async function logout() {
    (await cookies()).delete(ADMIN_COOKIE);
    redirect('/admin');
}
