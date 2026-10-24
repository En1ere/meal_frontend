import { verifySync } from 'otplib';
import type { MockState, Session } from './model.js';

export function adminUnlocked(session: Session, proof: string | null): boolean {
    return !!proof && !!session.adminUnlocks?.includes(proof);
}
export function adminCriticalUntil(session: Session, now: number): string | null {
    return session.criticalConfirmedUntil && Date.parse(session.criticalConfirmedUntil) > now
        ? session.criticalConfirmedUntil
        : null;
}
export function adminVerifyCode(
    state: MockState,
    session: Session,
    input: { code: string; method: 'totp' | 'recovery' },
    now: number,
): boolean {
    const factor = state.factors.find(
        (entry) => entry.userId === session.principal.id && entry.verified && !entry.revoked,
    );
    let accepted = false;
    if (factor && input.method === 'totp' && /^\d{6}$/.test(input.code)) {
        const checked = verifySync({
            strategy: 'totp',
            secret: factor.secret,
            token: input.code,
            digits: 6,
            period: 30,
            epoch: Math.floor(now / 1000),
            epochTolerance: 30,
        });
        if (checked.valid && 'timeStep' in checked && checked.timeStep > factor.lastStep) {
            factor.lastStep = checked.timeStep;
            accepted = true;
        }
    } else if (factor && input.method === 'recovery') {
        const index = factor.recoveryCodes.indexOf(input.code);
        if (index >= 0) {
            factor.recoveryCodes.splice(index, 1);
            accepted = true;
        }
    }
    if (accepted) session.adminMfaAttempts = 0;
    else {
        session.adminMfaAttempts = (session.adminMfaAttempts ?? 0) + 1;
        if (session.adminMfaAttempts >= 5) {
            session.revoked = true;
            session.adminUnlocks = [];
            delete session.criticalConfirmedUntil;
        }
    }
    return accepted;
}
