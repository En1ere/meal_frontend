import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Meal Planner',
        short_name: 'Meal Planner',
        description: 'Запасы, рецепты, покупки и приготовление в одном месте.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f2ea',
        theme_color: '#795548',
        lang: 'ru',
    };
}
