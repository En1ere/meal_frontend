import styles from './recipes.module.css';

export function recipeShellClassName(detail = false) {
    return `${styles.main} ${detail ? styles['detail-page'] : ''}`.trim();
}
