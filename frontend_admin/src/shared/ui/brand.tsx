import { Link } from 'react-router-dom';
export function Brand({ large = false }: { large?: boolean }) {
    return (
        <Link className={`brand${large ? ' brand-large' : ''}`} to="/" aria-label="Meal Planner — администрирование">
            <img src="/assets/food-122-brand-128.webp" alt="" width="44" height="54" />
            <span>
                Meal <span>Planner</span>
            </span>
        </Link>
    );
}
