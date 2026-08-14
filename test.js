const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { classify, classifyToken, normalizeLicense, findPackages, gateViolations } = require('./index.js');

function makePkg(dir, name, version, license) {
  const p = path.join(dir, 'node_modules', name);
  fs.mkdirSync(p, { recursive: true });
  fs.writeFileSync(path.join(p, 'package.json'), JSON.stringify({ name, version, license }));
  return p;
}

test('classifyToken 基础分类', () => {
  assert.strictEqual(classifyToken('MIT'), 'permissive');
  assert.strictEqual(classifyToken('Apache-2.0'), 'permissive');
  assert.strictEqual(classifyToken('GPL-3.0'), 'strong');
  assert.strictEqual(classifyToken('AGPL-3.0'), 'strong');
  assert.strictEqual(classifyToken('LGPL-2.1'), 'weak');
  assert.strictEqual(classifyToken('MPL-2.0'), 'weak');
  assert.strictEqual(classifyToken('CC-BY-4.0'), 'unknown');
  assert.strictEqual(classifyToken(''), 'unknown');
});

test('classify OR 取最严格（合规保守）', () => {
  assert.strictEqual(classify('MIT OR Apache-2.0'), 'permissive');
  assert.strictEqual(classify('MIT OR GPL-3.0'), 'strong');
  assert.strictEqual(classify('(MIT OR Apache-2.0) AND GPL-3.0'), 'strong');
  assert.strictEqual(classify('ISC AND BSD-3-Clause'), 'permissive');
});

test('classify 未知与私有声明', () => {
  assert.strictEqual(classify(''), 'unknown');
  assert.strictEqual(classify('UNLICENSED'), 'unknown');
  assert.strictEqual(classify('SEE LICENSE IN LICENSE'), 'unknown');
  assert.strictEqual(classify('Custom'), 'unknown');
});

test('normalizeLicense 兼容多格式', () => {
  assert.strictEqual(normalizeLicense({ license: 'MIT' }), 'MIT');
  assert.strictEqual(normalizeLicense({ licenses: [{ type: 'ISC' }] }), 'ISC');
  assert.strictEqual(normalizeLicense({}), '');
  assert.strictEqual(normalizeLicense(null), '');
});

test('findPackages 递归扫描含 scoped 与嵌套 node_modules', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'licguard-'));
  try {
    makePkg(root, 'foo', '1.0.0', 'MIT');
    const scoped = path.join(root, 'node_modules', '@scope', 'x');
    fs.mkdirSync(scoped, { recursive: true });
    fs.writeFileSync(path.join(scoped, 'package.json'), JSON.stringify({ name: '@scope/x', version: '1.0.0', license: 'ISC' }));
    // 嵌套 node_modules：bar 依赖 baz
    makePkg(root, 'bar', '1.0.0', 'BSD-3-Clause');
    makePkg(path.join(root, 'node_modules', 'bar'), 'baz', '2.0.0', 'GPL-3.0');
    const pkgs = findPackages(root);
    const names = pkgs.map(p => p.name).sort();
    assert.ok(names.includes('foo'), '应包含 foo');
    assert.ok(names.includes('bar'), '应包含 bar');
    assert.ok(names.includes('@scope/x'), '应包含 scoped 包 @scope/x');
    assert.ok(names.includes('baz'), '应递归扫描嵌套 node_modules 内的 baz');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('gateViolations 各模式', () => {
  const s = { permissive: 5, weak: 1, strong: 2, unknown: 3 };
  assert.strictEqual(gateViolations(s, 'strong'), 2);
  assert.strictEqual(gateViolations(s, 'unknown'), 3);
  assert.strictEqual(gateViolations(s, 'weak'), 1);
  assert.strictEqual(gateViolations(s, 'copyleft'), 6);
  assert.strictEqual(gateViolations(s, 'all'), 6);
  assert.strictEqual(gateViolations(s, 'danger'), 5);
  assert.strictEqual(gateViolations(s, null), 0);
});
