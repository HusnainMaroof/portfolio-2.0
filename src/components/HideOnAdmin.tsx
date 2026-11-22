'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Site chrome meant for visitors (Onee, the Socials link) stays off the
 * private dashboard, where it only covers the data on small screens.
 */
export default function HideOnAdmin({ children }: { children: ReactNode }) {
    return usePathname().startsWith('/admin') ? null : <>{children}</>;
}
