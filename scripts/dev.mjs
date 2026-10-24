import { spawn } from 'node:child_process';

const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this command with npm run dev');
const children = ['front', 'frontend_admin'].map((directory) =>
    spawn(process.execPath, [npm, '--prefix', directory, 'run', 'dev'], { stdio: 'inherit', env: process.env }),
);
let stopping = false;
function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
        else child.kill('SIGTERM');
    }
    process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
    child.on('error', (error) => {
        console.error(error.message);
        stop(1);
    });
    child.on('exit', (code) => stop(code ?? 1));
}
