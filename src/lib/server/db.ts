import 'server-only';
import { PrismaClient } from '@prisma/client';

/**
 * One Prisma client per server instance. In development, hot reload would
 * otherwise create a new client (and new connections) on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * True once real Neon credentials are in place. Until then every analytics
 * route answers 503 and the widgets hide themselves, so the site works
 * exactly as before.
 */
export const dbConfigured = () => {
    const url = process.env.DATABASE_URL ?? '';
    return url.startsWith('postgres') && !url.includes('USER:PASSWORD');
};
