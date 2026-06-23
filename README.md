# ZCode Account Switcher / ZCode 账号切换器

一个给 ZCode 桌面客户端使用的本地 Electron 账号切换器，用来保存多个 ZCode 登录凭据并快速切换账号。

关键词：ZCode account switcher、ZCode 账号切换、ZCode 多账号、Electron account switcher。

## 使用方式

```powershell
npm install
npm start
```

开发模式会自动打开窗口，并在 `src` 文件变化时重启 Electron：

```powershell
npm run dev
```

发布 Windows 安装包和便携版：

```powershell
npm run release:win -- --publish=never
```

如果 Electron 下载失败，可以使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 工作流

1. 先在 ZCode 里登录一个账号。
2. 打开本工具，它会自动保存当前账号凭据卡片。
3. 切换到另一个 ZCode 账号后重复保存。
4. 后续切换账号时，在本工具里点击目标账号的“切换”。如果 ZCode 正在运行，通常需要重启 ZCode 后生效。

切换时工具会先创建一份自动备份，再恢复目标账号快照。账号快照保存在 Electron 的用户数据目录中：

```text
%APPDATA%\zcode-account-switcher\profiles
```

## 当前快照范围

工具只保存和恢复账号凭据文件：

- `%USERPROFILE%\.zcode\v2\credentials.json`

它不会复制 Cookies、Local Storage、Session Storage、IndexedDB、Preferences 或其他 Electron 运行时目录。

## 注意

运行中切换只会替换磁盘上的 `credentials.json`。ZCode 已经加载到内存里的会话可能不会立刻变化，重启 ZCode 后最稳。
