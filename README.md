# ZCode Account Switcher / ZCode 账号切换器

ZCode Account Switcher is a local Electron desktop tool for switching multiple ZCode accounts. It saves and restores ZCode credential snapshots so you can manage different ZCode logins on the same Windows machine.

ZCode 账号切换器是一个本地 Electron 桌面工具，用于在同一台 Windows 电脑上保存、管理和切换多个 ZCode 登录账号。

**Search keywords / 搜索关键词**：ZCode account switcher, ZCode account manager, ZCode multiple accounts, ZCode login switcher, ZCode credential switcher, ZCode 账号切换, ZCode 多账号, ZCode 账号管理, ZCode 凭据切换, ZCode 登录切换, Electron account switcher.

## Download / 下载

Download the latest Windows installer from GitHub Releases:

从 GitHub Releases 下载最新 Windows 安装包：

https://github.com/jinpeng-vnode/zcode-account-switcher/releases

Recommended file:

推荐下载：

```text
ZCode.Account.Switcher.Setup.0.1.0.exe
```

## Features / 功能

- Detect the currently logged-in ZCode account.
- Save multiple ZCode account credential snapshots.
- Switch between saved ZCode accounts with one click.
- Create an automatic backup before restoring another account.
- Start or stop the ZCode desktop client from the tool.
- Local-first Electron app; credential snapshots stay on your own machine.

- 自动识别当前 ZCode 登录账号。
- 保存多个 ZCode 账号凭据快照。
- 一键切换已保存的 ZCode 账号。
- 切换前自动备份当前凭据。
- 可从工具内启动或关闭 ZCode 桌面客户端。
- 本地优先，账号快照保存在你自己的电脑上。

## Disclaimer / 免责声明

This project is open sourced under the MIT License and is provided for learning, research, and personal use only. Use it at your own risk.

本项目基于 MIT License 开源，仅用于学习交流、个人研究和自用场景。使用本工具即表示你理解并接受相关风险。

- This tool reads, saves, backs up, and restores local ZCode credential files. Use it only on your own device and your own accounts.
- The authors do not guarantee account safety, data safety, credential validity, service availability, or future ZCode compatibility.
- Any account issue, data loss, credential leak, service restriction, or other loss caused by using, modifying, distributing, or misusing this tool is the user's own responsibility.
- This project is not affiliated with, endorsed by, or supported by ZCode official teams.

- 本工具会读取、保存、备份和恢复本机 ZCode 凭据文件，请只在你自己的设备和账号上使用。
- 作者不保证账号安全、数据安全、凭据有效性、服务可用性或兼容未来版本。
- 因使用、修改、分发或误用本工具导致的账号异常、数据丢失、凭据泄露、服务限制或其他损失，均由使用者自行承担。
- 本项目与 ZCode 官方无关，不代表任何官方立场，也不提供任何官方支持。

See [LICENSE](LICENSE).

详见 [LICENSE](LICENSE)。

## Usage / 使用方式

Install dependencies and start the app:

安装依赖并启动应用：

```powershell
npm install
npm start
```

Development mode opens the Electron window and restarts it when files under `src` change:

开发模式会自动打开 Electron 窗口，并在 `src` 文件变化时自动重启：

```powershell
npm run dev
```

Build the Windows installer:

构建 Windows 安装包：

```powershell
npm run release:win -- --publish=never
```

If Electron download is slow or unavailable, use a mirror:

如果 Electron 下载失败或速度较慢，可以使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## Workflow / 工作流

1. Log in to one ZCode account in the ZCode desktop client.
2. Open ZCode Account Switcher. It will save the current account credential snapshot.
3. Log in to another ZCode account and repeat the save/sync step.
4. Later, choose a saved account and click switch. If ZCode is running, restart ZCode for the restored credentials to take effect.

1. 先在 ZCode 桌面客户端里登录一个账号。
2. 打开 ZCode Account Switcher，它会保存当前账号凭据快照。
3. 切换到另一个 ZCode 账号后重复保存。
4. 后续选择目标账号并点击切换。如果 ZCode 正在运行，通常需要重启 ZCode 后生效。

Credential snapshots are stored in the Electron user data directory:

账号快照保存在 Electron 用户数据目录：

```text
%APPDATA%\zcode-account-switcher\profiles
```

## Snapshot Scope / 快照范围

Current version saves and restores only the ZCode credential file:

当前版本只保存和恢复 ZCode 凭据文件：

```text
%USERPROFILE%\.zcode\v2\credentials.json
```

It does not copy Cookies, Local Storage, Session Storage, IndexedDB, Preferences, or other Electron runtime directories.

它不会复制 Cookies、Local Storage、Session Storage、IndexedDB、Preferences 或其他 Electron 运行时目录。

## License / 开源协议

MIT License. See [LICENSE](LICENSE).

MIT License，详见 [LICENSE](LICENSE)。
