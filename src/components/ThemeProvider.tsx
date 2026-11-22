'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

export type Theme = 'dark' | 'light';

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme';

/** Writes the theme onto <html> at once (CSS variables key off data-theme). */
const applyTheme = (next: Theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.style.colorScheme = next;
};

/**
 * Runs in <head> before the first paint, so a visitor who chose the light
 * theme never sees a dark frame first. Keep in sync with STORAGE_KEY.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'){var r=document.documentElement;r.setAttribute('data-theme','light');r.style.colorScheme='light'}}catch(e){}`;

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Dark is the site's default; light is the visitor's choice, remembered.
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        let saved: string | null = null;
        try {
            saved = window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // Storage can be blocked (private mode); dark it is.
        }
        const initial: Theme = saved === 'light' ? 'light' : 'dark';
        applyTheme(initial);
        setThemeState(initial);
    }, []);

    // The attribute is written synchronously here, not in an effect after the
    // render: the theme switch animation snapshots the page right after this
    // call, and needs the new colours already in place.
    const setTheme = useCallback((next: Theme) => {
        applyTheme(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Not remembered, still applied.
        }
        setThemeState(next);
    }, []);

    const value = useMemo(
        () => ({
            theme,
            setTheme,
            toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
        }),
        [theme, setTheme],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
