import process from 'node:process';
import { analyzeArchitecture } from './architecture-analyzer.mjs';

const { failures } = await analyzeArchitecture();

if (failures.length) {
    console.error(['Architecture boundary violations:', ...failures.map((item) => `- ${item}`)].join('\n'));
    process.exitCode = 1;
} else {
    console.log('Architecture boundaries are valid.');
}
