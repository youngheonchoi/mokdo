import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const cache = new Map();
export async function loadTS(path) {
    const url = path instanceof URL ? path : new URL(path, import.meta.url);
    async function encode(file) {
        if (cache.has(file.href)) return cache.get(file.href);
        const source = await readFile(file, 'utf8');
        let { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
        for (const match of [...outputText.matchAll(/from ['"](.+?)['"]/g)]) {
            if (!match[1].startsWith('.')) continue;
            const dependency = await encode(new URL(`${match[1]}.ts`, file));
            outputText = outputText.replace(match[0], `from '${dependency}'`);
        }
        const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
        cache.set(file.href, result);
        return result;
    }
    return import(await encode(url));
}
