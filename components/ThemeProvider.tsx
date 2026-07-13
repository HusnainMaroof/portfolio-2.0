'use client';

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

type Theme = 'dark' | 'light';

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');

    useEffect(() => {
        const savedTheme = window.localStorage.getItem('theme');
        const initialTheme = savedTheme === 'light' ? 'light' : 'dark';
        setThemeState(initialTheme);
        document.documentElement.setAttribute('data-theme', initialTheme);
        document.documentElement.style.colorScheme = initialTheme;
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    const value = useMemo(
        () => ({
            theme,
            toggleTheme: () =>
                setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
            setTheme: setThemeState,
        }),
        [theme],
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
