export const adminReleaseDraftKey = 'meal-admin-release-pending-v2';
const legacyAdminReleaseDraftKey = 'meal-admin-release-pending-v1';

export function clearAdminPrivateStorage(storage: Pick<Storage, 'removeItem'> = sessionStorage) {
    try {
        storage.removeItem(adminReleaseDraftKey);
    } catch {
        // Authentication cleanup must still complete when storage is unavailable.
    }
}

export function removeLegacyAdminPrivateStorage(storage: Pick<Storage, 'removeItem'> = localStorage) {
    try {
        storage.removeItem(legacyAdminReleaseDraftKey);
    } catch {
        // Legacy cleanup is best-effort in privacy-restricted browsers.
    }
}
