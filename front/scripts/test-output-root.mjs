import { mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

function findProjectsRoot(start) {
    let current = path.resolve(start);
    while (true) {
        if (path.basename(current).toLocaleLowerCase('en-US') === 'projects') return current;
        const parent = path.dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

export async function resolveTestOutputRoot(start, fixtureName) {
    const projectsRoot = findProjectsRoot(start);
    const runnerTemp = process.env.CI === 'true' ? process.env.RUNNER_TEMP : undefined;
    if (!projectsRoot && !runnerTemp)
        throw new Error(
            `${fixtureName} fixtures require either a repository ancestor directory named projects or CI RUNNER_TEMP`,
        );

    const permittedOutputRoot = projectsRoot
        ? path.join(projectsRoot, 'tempFiles')
        : path.join(path.resolve(runnerTemp), 'meal-frontend-tests');
    await mkdir(permittedOutputRoot, { recursive: true });
    const canonicalPermittedOutputRoot = await realpath(permittedOutputRoot);
    const requestedOutputRoot = process.env.QA_OUTPUT_DIR
        ? path.resolve(process.env.QA_OUTPUT_DIR)
        : canonicalPermittedOutputRoot;
    await mkdir(requestedOutputRoot, { recursive: true });
    const canonicalOutputRoot = await realpath(requestedOutputRoot);
    const relative = path.relative(canonicalPermittedOutputRoot, canonicalOutputRoot);
    if (relative.startsWith('..') || path.isAbsolute(relative))
        throw new Error(`QA_OUTPUT_DIR must resolve inside ${canonicalPermittedOutputRoot}: ${canonicalOutputRoot}`);
    return canonicalOutputRoot;
}
