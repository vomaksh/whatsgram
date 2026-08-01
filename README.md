<p align="center">
  <img src="./build/icons/256x256.png" width="128" alt="Whatsgram icon">
</p>

<h1 align="center">Whatsgram</h1>

<p align="center">
  A lightweight WhatsApp Web desktop client for Linux.
</p>

<p align="center">
  <a href="https://github.com/vomaksh/whatsgram/releases/latest">
    <strong>Download the latest release</strong>
  </a>
</p>

> Whatsgram is an independent project and is not affiliated with, endorsed by, or associated with WhatsApp or Meta.

## Features

- Dedicated desktop window for WhatsApp Web
- System tray integration
- Unread message count in the tray icon
- Opens downloaded files using installed system applications
- Packages for Debian, RPM and AppImage-based Linux distributions

## Download

Download the latest version from the [GitHub Releases page](https://github.com/vomaksh/whatsgram/releases/latest).

Choose the package appropriate for your system:

- `.rpm` for Fedora and other RPM-based distributions
- `.deb` for Debian, Ubuntu and related distributions
- `.AppImage` for a portable installation

## Development

Requires Node.js and pnpm.

```bash
git clone https://github.com/vomaksh/whatsgram.git
cd whatsgram
pnpm install
pnpm start
```

## Build

```bash
pnpm build:linux
```

Generated packages are written to the `dist` directory.

## License

Licensed under the [GNU General Public License v3.0](LICENSE.md).