# Koel Desktop via Electron with Discord RPC

## Description

This is just a really simple Electron wrapper around the [Koel Music Server](https://github.com/koel/koel) web client that sends the current track info to Discord Rich Presence. I love Koel and wanted to integrate it better with my personal use-cases. Hopefully this helps you too since you found yourself here 🤝

## Examples
![Example 1](/examples/1.png)

Album title tooltip as expected
![Example 2](/examples/2.png)

![Example 3](/examples/3.png)

## Usage

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications) to get your client ID and secret.
2. Clone this repository and, assuming you have [Node.js](https://nodejs.org) installed, run `npm install` to install the dependencies.
3. Copy `config.example.json` to create `config.json` and copy your Koel web client URL and Discord application strings to it respectively. Put your preferred callback URL in both the config and your Discord application settings - it is required by RPC via OAuth but unused by this application so it can be anything.
4. Run `npm start` to test the application is working correctly.
5. Run `npm run build` to package the application for Windows x64. You can modify the `build` script in `package.json` to change the target.

The packaged application will be in the `/builds` directory. You can run the executable or create a shortcut to it for desktop / start menu / taskbar pinning.

That's it ❤️ happy listening!