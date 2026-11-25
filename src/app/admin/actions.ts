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

/** Note moderation. Server actions are public endpoints: each re-checks the session. */
const moderate = async (formData: FormData, status: 'approved' | 'hidden' | 'delete') => {
    const { isAdmin } = await import('@/lib/server/admin-auth');
    if (!(await isAdmin())) return;

    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const { prisma } = await import('@/lib/server/db');
    if (status === 'delete') {
        await prisma.note.deleteMany({ where: { id } });
    } else {
        await prisma.note.updateMany({ where: { id }, data: { status } });
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/admin');
};

export async function approveNote(formData: FormData) {
    await moderate(formData, 'approved');
}

export async function hideNote(formData: FormData) {
    await moderate(formData, 'hidden');
}

export async function deleteNote(formData: FormData) {
    await moderate(formData, 'delete');
}
