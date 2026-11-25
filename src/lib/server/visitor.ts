import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Anonymous visitor id: a random value in a first-party cookie. It tells
 * "same browser again" apart from "new visitor" without storing any IP
 * address or personal data.
 */
export const VISITOR_COOKIE = 'vid';
const ONE_YEAR = 60 * 60 * 24 * 365;

export const readVisitorId = (req: NextRequest) => {
    const value = req.cookies.get(VISITOR_COOKIE)?.value;
    return value && /^[0-9a-f-]{36}$/.test(value) ? value : null;
};

export const getOrCreateVisitorId = (req: NextRequest) => {
    const existing = readVisitorId(req);
    return { id: existing ?? randomUUID(), isNew: !existing };
};

export const setVisitorCookie = (res: NextResponse, id: string) => {
    res.cookies.set(VISITOR_COOKIE, id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: ONE_YEAR,
    });
};

/** Country and city from Vercel's edge headers (absent in local dev). */
export const readLocation = (req: NextRequest) => {
    const decode = (value: string | null) => {
        if (!value) return null;
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };
    return {
        country: decode(req.headers.get('x-vercel-ip-country')),
        city: decode(req.headers.get('x-vercel-ip-city')),
    };
};

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|vercel-screenshot/i;

export const isBot = (userAgent: string) => !userAgent || BOT.test(userAgent);

/** A small, dependency-free read of the user agent: good enough for a dashboard. */
export const parseUserAgent = (ua: string) => {
    const device = /ipad|tablet/i.test(ua)
        ? 'Tablet'
        : /mobi|iphone|android/i.test(ua)
          ? 'Mobile'
          : 'Desktop';

    const browser = /edg\//i.test(ua)
        ? 'Edge'
        : /opr\/|opera/i.test(ua)
          ? 'Opera'
          : /samsungbrowser/i.test(ua)
            ? 'Samsung Internet'
            : /firefox|fxios/i.test(ua)
              ? 'Firefox'
              : /chrome|crios/i.test(ua)
                ? 'Chrome'
                : /safari/i.test(ua)
                  ? 'Safari'
                  : 'Other';

    const os = /windows/i.test(ua)
        ? 'Windows'
        : /iphone|ipad|ipod/i.test(ua)
          ? 'iOS'
          : /mac os/i.test(ua)
            ? 'macOS'
            : /android/i.test(ua)
              ? 'Android'
              : /linux/i.test(ua)
                ? 'Linux'
                : 'Other';

    return { device, browser, os };
};

/**
 * Keyed fingerprint of an IP address: the same IP always gives the same
 * value, but without ADMIN_SECRET it can't be reversed (IPs are few enough
 * to brute-force a plain hash). Used only to recognise a repeat visitor.
 */
export const hashIp = (ip: string | null) => {
    const secret = process.env.ADMIN_SECRET ?? '';
    if (!ip || secret.length < 32) return null;
    return createHmac('sha256', secret).update(ip).digest('hex').slice(0, 32);
};
