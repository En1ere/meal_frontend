// A full navigation prevents the outgoing protected page's guard from overriding
// the password-change result URL while its session observers are being cleared.
export function leaveRevokedSessions(runtime: { reset: () => void; broadcast: () => void }) {
    runtime.reset();
    runtime.broadcast();
    window.location.replace('/auth?notice=password-changed');
}
