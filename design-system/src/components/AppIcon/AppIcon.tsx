import type { ReactNode, SVGProps } from 'react';

export type AppIconName =
    | 'achievements'
    | 'ai'
    | 'close'
    | 'community'
    | 'diary'
    | 'family'
    | 'home'
    | 'inventory'
    | 'more'
    | 'news'
    | 'notifications'
    | 'plan'
    | 'profile'
    | 'recipes'
    | 'search'
    | 'settings'
    | 'shopping'
    | 'support';

const paths: Record<AppIconName, ReactNode> = {
    home: (
        <>
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10.5V21h13V10.5M9.5 21v-6h5v6" />
        </>
    ),
    inventory: (
        <>
            <path d="M5 5h14v16H5z" />
            <path d="M8 5V3h8v2M8 10h8M8 14h8" />
        </>
    ),
    recipes: (
        <>
            <path d="M5 3h14v18H5z" />
            <path d="M8 7h8M8 11h8M8 15h5" />
        </>
    ),
    plan: (
        <>
            <rect
                x="4"
                y="5"
                width="16"
                height="15"
                rx="2"
            />
            <path d="M8 3v4M16 3v4M4 10h16" />
        </>
    ),
    shopping: (
        <>
            <path d="M4 8h16l-2 12H6L4 8Z" />
            <path d="m8 8 2-4M16 8l-2-4M9 12v4M15 12v4" />
        </>
    ),
    family: (
        <>
            <circle
                cx="8"
                cy="8"
                r="3"
            />
            <circle
                cx="17"
                cy="9"
                r="2.5"
            />
            <path d="M2.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6M13 15c3.5-1 6.5 1 7.5 5" />
        </>
    ),
    community: (
        <>
            <path d="M4 5h16v11H9l-5 4V5Z" />
            <path d="M8 9h8M8 12h5" />
        </>
    ),
    profile: (
        <>
            <circle
                cx="12"
                cy="8"
                r="4"
            />
            <path d="M4 21c.6-5 3.2-7 8-7s7.4 2 8 7" />
        </>
    ),
    settings: (
        <>
            <circle
                cx="12"
                cy="12"
                r="3"
            />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
        </>
    ),
    search: (
        <>
            <circle
                cx="10.5"
                cy="10.5"
                r="6.5"
            />
            <path d="m16 16 5 5" />
        </>
    ),
    notifications: (
        <>
            <path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5L6 17Z" />
            <path d="M10 20h4" />
        </>
    ),
    more: (
        <>
            <circle
                cx="5"
                cy="12"
                r="1.5"
            />
            <circle
                cx="12"
                cy="12"
                r="1.5"
            />
            <circle
                cx="19"
                cy="12"
                r="1.5"
            />
        </>
    ),
    ai: (
        <>
            <path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" />
            <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
        </>
    ),
    diary: (
        <>
            <path d="M5 3h14v18H5z" />
            <path d="M9 3v18M12 8h4M12 12h4" />
        </>
    ),
    achievements: (
        <>
            <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
            <path d="M8 6H4v1c0 3 2 5 5 5M16 6h4v1c0 3-2 5-5 5M12 13v4M8 21h8M9 17h6v4" />
        </>
    ),
    news: (
        <>
            <path d="M4 4h16v16H4z" />
            <path d="M8 8h8M8 12h8M8 16h5" />
        </>
    ),
    support: (
        <>
            <circle
                cx="12"
                cy="12"
                r="9"
            />
            <path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01" />
        </>
    ),
    close: <path d="m5 5 14 14M19 5 5 19" />,
};

export function AppIcon({ name, ...props }: { name: AppIconName } & Omit<SVGProps<SVGSVGElement>, 'children'>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {paths[name]}
        </svg>
    );
}
