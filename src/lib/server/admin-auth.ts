import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Admin sign-in for the visitor dashboard.
 *
 * The password lives only in the ADMIN_PASSWORD environment variable and is
 * checked on the server. A successful sign-in sets an httpOnly cookie holding
 * an expiry time signed with ADMIN_SECRET; nothing secret ever reaches the
 * browser.
 */
export const ADMIN_COOKIE = 'admin_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

const secret = () => process.env.ADMIN_SECRET ?? '';

export const adminConfigured = () =>
    (process.env.ADMIN_PASSWORD ?? '').length > 0 &&
    !process.env.ADMIN_PASSWORD!.startsWith('choose-a-') &&
    secret().length >= 32 &&
    !secret().startsWith('replace-with');

const sign = (value: string) =>
    createHmac('sha256', secret()).update(value).digest('hex');

/** Constant-time comparison, so the response time leaks nothing. */
const sameText = (a: string, b: string) => {
    const left = createHash('sha256').update(a).digest();
    const right = createHash('sha256').update(b).digest();
    return timingSafeEqual(left, right);
};

export const passwordMatches = (attempt: string) =>
    adminConfigured() && sameText(attempt, process.env.ADMIN_PASSWORD!);

export const createSessionValue = () => {
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    return `${expires}.${sign(String(expires))}`;
};

export const sessionCookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_SECONDS,
};

export const isAdmin = async () => {
    if (!adminConfigured()) return false;
    const value = (await cookies()).get(ADMIN_COOKIE)?.value ?? '';
    const [expires, signature] = value.split('.');
    if (!expires || !signature) return false;
    if (Number(expires) * 1000 < Date.now()) return false;
    return sameText(signature, sign(expires));
};
