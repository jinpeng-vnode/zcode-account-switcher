# ZCode 智谱账号切换器 / ZCode Account Switcher

ZCode 智谱账号切换器是一个本地 Electron 桌面工具，用于在同一台 Windows 电脑上保存、管理和切换多个 ZCode 登录账号，适用于通过 BigModel、Z.ai、智谱 AI、智谱清言 / ChatGLM、GLM Coding Plan、智谱开放平台绑定的 ZCode 账号。

**搜索关键词**：ZCode 账号切换、ZCode 多账号、ZCode 账号管理、ZCode 凭据切换、ZCode 登录切换、智谱账号切换、智谱清言账号切换、智谱 AI 多账号、BigModel 账号切换、Z.ai 账号切换、GLM Coding Plan 账号切换、ZCode account switcher、BigModel account switcher、Z.ai account switcher、ChatGLM account switcher。

## 这个工具解决什么问题

ZCode 官方文档里有 BigModel 和 Z.ai 两种智谱相关连接方式：BigModel 面向智谱开放平台、GLM Coding Plan、模型资源包和充值余额；Z.ai 面向海外/国际账号路径。本工具聚焦本机 ZCode 桌面端凭据文件，方便你为这些登录路径保存多个账号快照并快速切换。

常见场景：

- 在多个 ZCode 账号之间切换。
- 在 BigModel.cn 国内账号和 Z.ai 国际账号之间切换。
- 管理绑定智谱 AI、智谱清言、ChatGLM、GLM Coding Plan 的 ZCode 账号。
- 为个人测试、学习交流、研究用途的账号保存独立快照。

相关官方文档：

- ZCode API key 配置: https://zcode.z.ai/cn/docs/legacy/configuration
- ZCode API Key Setup: https://zcode.z.ai/en/docs/configuration
- Z.ai / Zhipu AI: https://www.zhipuai.cn/en/

## 下载

从 GitHub Releases 下载最新 Windows 安装包：

https://github.com/jinpeng-vnode/zcode-account-switcher/releases

推荐下载：

```text
ZCode.Account.Switcher.Setup.0.1.0.exe
```

## 功能

- 自动识别当前 ZCode 登录账号。
- 保存多个 ZCode / BigModel / Z.ai 账号凭据快照。
- 一键切换已保存的 ZCode 账号。
- 切换前自动备份当前凭据。
- 可从工具内启动或关闭 ZCode 桌面客户端。
- 本地优先，账号快照保存在你自己的电脑上。

## 免责声明

本项目基于 MIT License 开源，仅用于学习交流、个人研究和自用场景。使用本工具即表示你理解并接受相关风险。

- 本工具会读取、保存、备份和恢复本机 ZCode 凭据文件，请只在你自己的设备和账号上使用。
- 作者不保证账号安全、数据安全、凭据有效性、服务可用性或兼容未来版本。
- 因使用、修改、分发或误用本工具导致的账号异常、数据丢失、凭据泄露、服务限制或其他损失，均由使用者自行承担。
- 本项目与 ZCode 官方无关，不代表任何官方立场，也不提供任何官方支持。

详见 [LICENSE](LICENSE)。

## 使用方式

安装依赖并启动应用：

```powershell
npm install
npm start
```

开发模式会自动打开 Electron 窗口，并在 `src` 文件变化时自动重启：

```powershell
npm run dev
```

构建 Windows 安装包：

```powershell
npm run release:win -- --publish=never
```

如果 Electron 下载失败或速度较慢，可以使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 工作流

1. 先在 ZCode 桌面客户端里登录一个账号。
2. 打开 ZCode Account Switcher，它会保存当前账号凭据快照。
3. 切换到另一个 ZCode 账号后重复保存。
4. 后续选择目标账号并点击切换。如果 ZCode 正在运行，通常需要重启 ZCode 后生效。

账号快照保存在 Electron 用户数据目录：

```text
%APPDATA%\zcode-account-switcher\profiles
```

## 快照范围

当前版本只保存和恢复 ZCode 凭据文件：

```text
%USERPROFILE%\.zcode\v2\credentials.json
```

它不会复制 Cookies、Local Storage、Session Storage、IndexedDB、Preferences 或其他 Electron 运行时目录。

## 开源协议

MIT License，详见 [LICENSE](LICENSE)。

## English

ZCode Account Switcher is a local Electron desktop tool for switching multiple ZCode accounts, including ZCode logins connected through BigModel, Z.ai, Zhipu AI, 智谱清言 / ChatGLM, GLM Coding Plan, or the Zhipu open platform.

**Search keywords**: ZCode account switcher, ZCode account manager, ZCode multiple accounts, ZCode login switcher, ZCode credential switcher, BigModel account switcher, BigModel.cn, Z.ai account switcher, ZAI account switcher, Zhipu AI account switcher, ChatGLM account switcher, GLM Coding Plan, 智谱账号切换, 智谱清言账号切换, BigModel 账号切换, Z.ai 账号切换.

### What It Is For

ZCode can connect model services through BigModel and Z.ai. Official ZCode documentation describes BigModel as the Zhipu open platform route for GLM Coding Plan, model resource packages, and prepaid balance, while Z.ai is the international/overseas account route. This tool focuses on the local ZCode desktop credential file and makes it easier to keep separate account snapshots for those login routes.

Common scenarios:

- Switch between different ZCode accounts.
- Switch between BigModel.cn domestic accounts and Z.ai international accounts.
- Manage ZCode accounts tied to 智谱 AI / 智谱清言 / ChatGLM / GLM Coding Plan.
- Keep separate snapshots for personal testing, learning, or research accounts.

Official docs:

- ZCode API Key Setup: https://zcode.z.ai/en/docs/configuration
- ZCode API key 配置: https://zcode.z.ai/cn/docs/legacy/configuration
- Z.ai / Zhipu AI: https://www.zhipuai.cn/en/

### Download

Download the latest Windows installer from GitHub Releases:

https://github.com/jinpeng-vnode/zcode-account-switcher/releases

Recommended file:

```text
ZCode.Account.Switcher.Setup.0.1.0.exe
```

### Features

- Detect the currently logged-in ZCode account.
- Save multiple ZCode / BigModel / Z.ai account credential snapshots.
- Switch between saved ZCode accounts with one click.
- Create an automatic backup before restoring another account.
- Start or stop the ZCode desktop client from the tool.
- Local-first Electron app; credential snapshots stay on your own machine.

### Disclaimer

This project is open sourced under the MIT License and is provided for learning, research, and personal use only. Use it at your own risk.

- This tool reads, saves, backs up, and restores local ZCode credential files. Use it only on your own device and your own accounts.
- The authors do not guarantee account safety, data safety, credential validity, service availability, or future ZCode compatibility.
- Any account issue, data loss, credential leak, service restriction, or other loss caused by using, modifying, distributing, or misusing this tool is the user's own responsibility.
- This project is not affiliated with, endorsed by, or supported by ZCode official teams.

See [LICENSE](LICENSE).

### Usage

Install dependencies and start the app:

```powershell
npm install
npm start
```

Development mode opens the Electron window and restarts it when files under `src` change:

```powershell
npm run dev
```

Build the Windows installer:

```powershell
npm run release:win -- --publish=never
```

If Electron download is slow or unavailable, use a mirror:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### Workflow

1. Log in to one ZCode account in the ZCode desktop client.
2. Open ZCode Account Switcher. It will save the current account credential snapshot.
3. Log in to another ZCode account and repeat the save/sync step.
4. Later, choose a saved account and click switch. If ZCode is running, restart ZCode for the restored credentials to take effect.

Credential snapshots are stored in the Electron user data directory:

```text
%APPDATA%\zcode-account-switcher\profiles
```

### Snapshot Scope

Current version saves and restores only the ZCode credential file:

```text
%USERPROFILE%\.zcode\v2\credentials.json
```

It does not copy Cookies, Local Storage, Session Storage, IndexedDB, Preferences, or other Electron runtime directories.

### License

MIT License. See [LICENSE](LICENSE).
