#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

// ---- 类别优先级（用于 OR/AND 表达式中取最严格）----
const PRIORITY = { strong: 3, weak: 2, unknown: 1, permissive: 0 };

// 单 token 分类
function classifyToken(t) {
  const s = String(t).trim().toLowerCase();
  if (!s) return 'unknown';
  if (/^lgpl/.test(s) || /\blgpl\b/.test(s)) return 'weak';            // LGPL 弱 copyleft，必须先于 gpl 命中
  if (/agpl|gpl|eupl/.test(s)) return 'strong';                        // AGPL/GPL 强 copyleft
  if (/mpl|epl|cddl|osl|cecill/.test(s)) return 'weak';               // 其余弱 copyleft
  if (/^(mit|isc|apache|bsd|bsl|zlib|unlicense|wtfpl|0bsd|mit-0|cc0|ms-pl|boost|apl|python)/.test(s)) return 'permissive';
  return 'unknown';
}

// 表达式分类（SPDX 子集：支持 OR / AND / 括号，取最严格 token）
function classify(expr) {
  if (!expr) return 'unknown';
  const s = String(expr).trim();
  if (/unlicensed|see license|proprietary|commercial|custom/i.test(s)) return 'unknown';
  const tokens = s.split(/\s+(?:or|and)\s+/i)
    .map(t => t.replace(/[()]/g, '').trim())
    .filter(Boolean);
  if (tokens.length === 0) return 'unknown';
  let best = 'permissive';
  for (const t of tokens) {
    const c = classifyToken(t);
    if (PRIORITY[c] > PRIORITY[best]) best = c;
  }
  return best;
}

// 归一化 license 字段（兼容 license / licenses[] / licenses.type）
function normalizeLicense(pkg) {
  if (!pkg || typeof pkg !== 'object') return '';
  if (typeof pkg.license === 'string') return pkg.license;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length) {
    const f = pkg.licenses[0];
    if (typeof f === 'string') return f;
    if (f && typeof f.type === 'string') return f.type;
  }
  if (pkg.licenses && typeof pkg.licenses.type === 'string') return pkg.licenses.type;
  return '';
}

// 递归扫描 node_modules（含 scoped 包与嵌套 node_modules）
function findPackages(root) {
  const nm = path.join(root, 'node_modules');
  const out = [];
  if (!fs.existsSync(nm)) return out;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.')) continue;                          // 跳过 .bin 等
      const full = path.join(dir, e.name);
      if (e.name === 'node_modules') { walk(full); continue; }
      const pj = path.join(full, 'package.json');
      if (fs.existsSync(pj)) {
        try {
          const p = JSON.parse(fs.readFileSync(pj, 'utf8'));
          out.push({
            name: p.name || e.name,
            version: p.version || '',
            license: normalizeLicense(p),
            dir: full,
          });
        } catch { /* 坏 JSON 跳过 */ }
      }
      walk(full);
    }
  };
  walk(nm);
  return out;
}

// 门禁命中计数
function gateViolations(summary, failOn) {
  if (!failOn) return 0;
  switch (failOn) {
    case 'strong': return summary.strong;
    case 'unknown': return summary.unknown;
    case 'weak': return summary.weak;
    case 'copyleft':
    case 'all': return summary.strong + summary.weak + summary.unknown;
    case 'danger': return summary.strong + summary.unknown;
    default: return 0;
  }
}

const CAT_LABEL = { permissive: '宽松', weak: '弱传染', strong: '强传染', unknown: '未知' };
const CAT_COLOR = { permissive: '\x1b[32m', weak: '\x1b[33m', strong: '\x1b[31m', unknown: '\x1b[35m' };
const RESET = '\x1b[0m';

function printHelp() {
  console.log(`licguard —— 依赖许可证合规扫描（零依赖 / 离线 / 确定性 / 可进 CI）

用法:
  licguard [目录] [选项]

选项:
  -h, --help              显示本帮助
  --json                  JSON 输出（机器可读，便于 CI 解析）
  --no-color              关闭颜色（管道 / 无色终端友好）
  --max <n>               高危许可证(强传染 + 未知)超过 n 个则 exit 2
  --fail-on <mode>        命中即 exit 2：strong | weak | unknown | copyleft | all | danger

类别:
  宽松(permissive)  MIT / ISC / Apache / BSD 等 —— 安全
  弱传染(weak)      LGPL / MPL / EPL 等 —— 警示
  强传染(strong)    GPL / AGPL 等 —— 高危（可能要求整体开源）
  未知(unknown)     无 license 字段 / 无法解析 / 私有 —— 需人工确认

示例:
  licguard .                       扫描当前项目依赖
  licguard . --fail-on strong      发现任何 GPL/AGPL 直接失败（CI 门禁）
  licguard . --max 0               零容忍任何高危 / 未知许可`);
}

function main() {
  const args = process.argv.slice(2);
  let dir = '.';
  let json = false, noColor = false, max = null, failOn = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') { printHelp(); return; }
    if (a === '--json') json = true;
    else if (a === '--no-color') noColor = true;
    else if (a === '--max') {
      max = parseInt(args[++i], 10);
      if (!Number.isFinite(max)) { console.error('--max 需要整数'); process.exit(2); }
    } else if (a === '--fail-on') {
      failOn = args[++i];
      if (!['strong', 'weak', 'unknown', 'copyleft', 'all', 'danger'].includes(failOn)) {
        console.error('未知 --fail-on 模式: ' + failOn);
        process.exit(2);
      }
    } else if (!a.startsWith('-')) dir = a;
    else { console.error('未知选项: ' + a); process.exit(2); }
  }

  let pkgs;
  try { pkgs = findPackages(path.resolve(dir)); }
  catch (e) { console.error('无法读取目录: ' + dir); process.exit(2); }

  const rows = pkgs.map(p => ({ ...p, category: classify(p.license) }));
  const summary = { permissive: 0, weak: 0, strong: 0, unknown: 0 };
  rows.forEach(r => summary[r.category]++);

  if (json) {
    console.log(JSON.stringify({ scanned: rows.length, summary, packages: rows }, null, 2));
    const danger = summary.strong + summary.unknown;
    if (max !== null && danger > max) process.exit(2);
    if (gateViolations(summary, failOn) > 0) process.exit(2);
    return;
  }

  console.log(`\n扫描目录 : ${path.resolve(dir)}`);
  console.log(`依赖总数 : ${rows.length}\n`);
  console.log('包名'.padEnd(34) + '版本'.padEnd(12) + '许可证'.padEnd(22) + '类别');
  console.log('-'.repeat(80));
  for (const r of rows) {
    const label = CAT_LABEL[r.category];
    const color = noColor ? '' : (CAT_COLOR[r.category] || '');
    const catStr = noColor ? label : color + label + RESET;
    console.log(
      String(r.name).slice(0, 32).padEnd(34) +
      String(r.version).padEnd(12) +
      String(r.license || '(无)').slice(0, 20).padEnd(22) +
      catStr
    );
  }
  console.log('-'.repeat(80));
  console.log(`汇总  宽松:${summary.permissive}  弱传染:${summary.weak}  强传染:${summary.strong}  未知:${summary.unknown}`);

  const danger = summary.strong + summary.unknown;
  if (max !== null && danger > max) {
    console.error(`\n✗ 高危许可证(${danger})超过上限(${max})，退出码 2`);
    process.exit(2);
  }
  const v = gateViolations(summary, failOn);
  if (v > 0) {
    console.error(`\n✗ 命中 --fail-on ${failOn} 的包 ${v} 个，退出码 2`);
    process.exit(2);
  }
  console.log('');
}

if (require.main === module) main();
module.exports = { classify, classifyToken, normalizeLicense, findPackages, gateViolations };
