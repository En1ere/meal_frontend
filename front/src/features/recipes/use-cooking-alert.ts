'use client';
import { useEffect, useRef, useState } from 'react';

// Best effort while this screen is mounted. Absolute deadlines remain server-owned.
export function useCookingAlert(attemptId: string, deadline: string | null) {
    const audio = useRef<AudioContext | null>(null);
    const notified = useRef(new Set<string>());
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(
        () => () => {
            const context = audio.current;
            audio.current = null;
            if (context) void context.close().catch(() => undefined);
        },
        [],
    );
    async function enable() {
        try {
            const context = audio.current ?? new AudioContext();
            audio.current = context;
            await context.resume();
            setEnabled(true);
            setMessage('Сигнал включён для открытого экрана готовки. Фоновое срабатывание зависит от устройства.');
        } catch {
            setEnabled(true);
            setMessage('Звук недоступен. Окончание таймера будет показано на экране.');
        }
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch {
                /* Optional system notification permission. */
            }
        }
    }
    useEffect(() => {
        if (!enabled || !deadline) return;
        const key = `${attemptId}:${deadline}`;
        const expires = Date.parse(deadline);
        if (!Number.isFinite(expires)) return;
        const check = () => {
            if (Date.now() < expires || notified.current.has(key)) return;
            notified.current.add(key);
            setMessage('Время шага закончилось. Проверьте блюдо; шаг не отмечен выполненным автоматически.');
            try {
                navigator.vibrate?.([150, 80, 150]);
            } catch {
                /* Unsupported devices keep the visible message. */
            }
            const context = audio.current;
            if (context?.state === 'running') {
                const oscillator = context.createOscillator(),
                    gain = context.createGain();
                oscillator.frequency.value = 660;
                gain.gain.value = 0.08;
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start();
                oscillator.stop(context.currentTime + 0.3);
                oscillator.onended = () => {
                    oscillator.disconnect();
                    gain.disconnect();
                };
            }
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                try {
                    const notification = new Notification('Таймер приготовления', {
                        body: 'Время шага закончилось: проверьте блюдо.',
                        tag: key,
                    });
                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };
                } catch {
                    /* Closed-app push requires a separate delivery transport. */
                }
            }
        };
        check();
        const timer = window.setInterval(check, 1000);
        document.addEventListener('visibilitychange', check);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', check);
        };
    }, [attemptId, deadline, enabled]);
    return { enabled, enable, message };
}
