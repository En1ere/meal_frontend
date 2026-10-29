'use client';

import { useState } from 'react';
import { isRecipeImageSourceAllowed, recipeRatingText } from './model.js';
import styles from './recipe.module.css';

export function RecipeImage({
    src,
    alt,
    className,
}: {
    src: string | null;
    alt: string;
    className?: string | undefined;
}) {
    const [failed, setFailed] = useState(false);
    if (!isRecipeImageSourceAllowed(src) || failed)
        return (
            <div className={className ?? styles.panel} role="img" aria-label={`Изображение отсутствует: ${alt}`}>
                Фото ещё не добавлено
            </div>
        );
    return (
        <img src={src} alt={alt} className={className} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
    return <span>{recipeRatingText(rating, count)}</span>;
}
