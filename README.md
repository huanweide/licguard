# licguard

零依赖 Node CLI：扫描 `node_modules` 依赖许可证，识别 **GPL/AGPL 强 copyleft** 与未知许可，可进 CI 做合规门禁。

## 为什么需要它

你 `npm install` 一键装下的几百个包，可能藏着一颗 **GPL/AGPL 地雷**——一旦你的项目被判定为衍生作品，可能被迫开源全部源码。`licguard` 把「我的项目有几个传染型许可证」变成一行命令、一张彩色表，像 [`idiot-index`](https://github.com/huanweide/idiot-index) 称依赖胖瘦那样，称一称依赖的「法律体重」。

## 安装

```bash
git clone https://github.com/huanweide/licguard
cd licguard
node index.js .          # 零依赖：无需 npm install 任何东西
```

## 用法

```bash
node index.js .                        # 扫描当前项目依赖，彩色表格
node index.js . --json                # JSON 输出，给 CI 解析
node index.js . --fail-on strong      # 发现任何 GPL/AGPL 直接 exit 2（CI 门禁）
node index.js . --max 0               # 零容忍任何高危 / 未知许可
node index.js . --no-color            # 关颜色，管道友好
```

## 许可证类别

| 类别 | 含义 | 代表 |
|---|---|---|
| 宽松 permissive | 安全 | MIT / ISC / Apache / BSD |
| 弱传染 weak | 警示 | LGPL / MPL / EPL |
| 强传染 strong | 高危（可能要求整体开源） | GPL / AGPL |
| 未知 unknown | 需人工确认 | 无 license / UNLICENSED / 私有 |

SPDX 表达式（`MIT OR Apache-2.0`、`(MIT) AND GPL-3.0`）取**最严格** token 分类，合规保守。

## CI 集成

```yaml
- run: node licguard/index.js . --fail-on strong
```

## 与 idiot-index 的关系

`idiot-index` 查依赖「胖不胖」（冗余 / 过度工程），`licguard` 查依赖「干不干净」（法律传染风险）——合称**依赖体检双子**。

## License

MIT

---

## 作者

由 **ReTr · 樊斯瑞** 维护 · [GitHub 主页](https://github.com/huanweide)

## CI 门禁用法

开箱即可接入 CI：在流水线中运行本工具，它会输出健康分与严重度；若存在不达标项会以非 0 退出码结束，从而拦下问题提交（具体参数见上方「快速开始」）。

## 赞助支持

如果这个项目帮到了你，欢迎 [点 Star](https://github.com/huanweide/licguard) 支持；也可微信扫码自愿赞助（收款码见 `sponsor/wechat-qr.png`，作者本人带 Tri 水印的码，纯静态图片、不含任何密钥）。

## 许可证

详见 [LICENSE](LICENSE)。
