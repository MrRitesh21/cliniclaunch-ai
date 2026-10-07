// Offline compiler/error-boundary regression; extracts actual route JSX, no application boot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['__root.tsx', 'c.$slug.tsx', 'clinic-software.$city.tsx', 'compare.$competitor.tsx', 'for.$specialty.tsx', 'index.tsx'];
for (const file of files) test(`${file}: unknown thrown values never expose clinical or credential details`, () => {
  const source = fs.readFileSync(path.join(root, 'src/routes', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let boundary;
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'ErrorComponent') boundary = node.getText(ast);
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'errorComponent' && ts.isArrowFunction(node.initializer)) boundary = `const ErrorComponent = ${node.initializer.getText(ast)};`;
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.ok(boundary, 'real route error boundary missing');
  assert.match(source, /ErrorComponentProps/);
  const code = ts.transpileModule(boundary + '\n globalThis.boundary = ErrorComponent;', { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
  for (const error of [new Error('SYNTHETIC-PHI-SECRET'), { message: 'SYNTHETIC-PHI-SECRET' }, 'SYNTHETIC-PHI-SECRET', null, undefined, 17]) {
    const observed = [];
    const context = { Error, React: { createElement: (type, props, ...children) => ({ type: typeof type === 'string' ? type : 'component', props, children }) },
      Link: () => {}, MarketingShell: () => {}, useRouter: () => ({ invalidate() {} }), useEffect: fn => fn(),
      reportLovableError: (err, metadata) => observed.push([String(err), metadata]),
      console: { error: (...args) => observed.push(args.map(String)) } };
    vm.createContext(context); vm.runInContext(code, context);
    const tree = context.boundary({ error, reset() {} });
    assert.ok(tree); assert.doesNotMatch(JSON.stringify([tree, observed]), /SYNTHETIC-PHI-SECRET/);
  }
});
test('generated tree includes exact internal job route without local registration casts', () => {
  const tree = fs.readFileSync(path.join(root, 'src/routeTree.gen.ts'), 'utf8');
  assert.match(tree, /'\/api\/internal\/clinicx-jobs':/);
  assert.match(tree, /declare module '@tanstack\/react-start'/, 'official Start registration footer must survive route regeneration');
  assert.match(tree, /config: Awaited<ReturnType<typeof startInstance.getOptions>>/);
  const route = fs.readFileSync(path.join(root, 'src/routes/api/internal/clinicx-jobs.ts'), 'utf8');
  assert.match(route, /createFileRoute\("\/api\/internal\/clinicx-jobs"\)/);
  assert.doesNotMatch(route, /as any|@ts-ignore|@ts-nocheck/);
});
