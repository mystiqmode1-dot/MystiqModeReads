import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { runInNewContext } from 'node:vm';

// Exercise the actual server guard with both native path implementations.
const guard = readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  .split('\n').find(line => line.includes("const file=resolve('public'"));
for (const [platform, paths, root] of [
  ['Windows', win32, 'C:\\Users\\Hp\\Downloads\\MystiqModeReads-main'],
  ['POSIX', posix, '/workspace/MystiqModeReads'],
]) {
  test(`${platform}: serve public files and reject paths outside public`, () => {
    for (const [request, allowed] of [['/', true], ['/app.js', true], ['/style.css', true], ['/../server.js', false], ['/../public-other/secret.txt', false], ['/..\\server.js', platform !== 'Windows']]) {
      const result = runInNewContext(`(() => { ${guard}\nreturn file; })()`, {
        path: request, sep: paths.sep,
        resolve: (...parts) => paths.resolve(root, ...parts),
        res: {}, json: (_res, status) => status,
      });
      assert.equal(typeof result === 'string', allowed, request);
      if (!allowed) assert.equal(result, 403);
    }
  });
}
