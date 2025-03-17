const { app, BrowserWindow, ipcMain } = require('electron');
const RPC = require('discord-rpc');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');
const client = new RPC.Client({ transport: 'ipc' });

// Path for storing tokens
const tokenPath = path.join(app.getPath('userData'), 'discord_token.json');

// Token storage
let tokenData = {
  accessToken: null,
  expiresAt: 0
};

// Load any existing token
try {
  if (fs.existsSync(tokenPath)) {
    tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('Loaded saved Discord token');
  }
} catch (err) {
  console.error('Failed to load token:', err);
}

let win;
let currentSong = {
  title: 'Listening to Koel',
  artist: '',
  albumIconUrl: '',
  albumTitle: '',
  currentTime: new Date()
};

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the Koel web app
  win.loadURL(config.appUrl);

  win.on('closed', () => {
    win = null;
  });

  // Prevent from spawning new windows
  win.webContents.on('new-window', (event, url) => {
    event.preventDefault()
    win.loadURL(url)
  });
}

// Save token to file
function saveToken(token) {
  if (!token || !token.accessToken) return;
  
  tokenData = {
    accessToken: token.accessToken,
    expiresAt: Date.now() + ((token.expiresIn || 86400) * 1000)
  };
  
  fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
  console.log('Discord token saved');
}

client.on('ready', () => {
  console.log('Discord RPC is ready');
});

// Listen for token updates
client.on('tokenUpdate', (token) => {
  console.log('Token updated, saving new token');
  saveToken(token);
});

// Handle song update
ipcMain.on('song-update', (event, songInfo) => {
  if (currentSong.title !== songInfo.title && !!songInfo.albumTitle) {
    currentSong = {
      title: songInfo.title,
      artist: songInfo.artist,
      albumIconUrl: songInfo.albumIconUrl,
      albumTitle: songInfo.albumTitle,
      startTimestamp: songInfo.currentTime ? Date.now() - (songInfo.currentTime * 1000) : Date.now()
    };

    updateDiscordActivity();
  }
});

// Update Discord activity with new song
function updateDiscordActivity() {
  console.log('Song updated:', currentSong);
  client.setActivity({
    details: currentSong.title,
    state: `by ${currentSong.artist}`,
    largeImageKey: currentSong.albumIconUrl || 'logo',
    largeImageText: currentSong.albumTitle || 'Koel',
    smallImageKey: 'playing',
    smallImageText: 'Playing a song',
    startTimestamp: currentSong.currentTime,
    instance: true,
  }).catch(console.error);
}

app.on('ready', () => {
  createWindow();

  // Configure login options
  let loginOptions = {
    scopes: ['rpc'],
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    clientSecret: config.clientSecret
  };

  // Add token if we have a valid one
  if (!!tokenData.accessToken && Date.now() < tokenData.expiresAt) {
    console.log('Login using cached access token');
    loginOptions.accessToken = tokenData.accessToken;
  }

  // Log in to Discord RPC
  client.login(loginOptions)
  .then((result) => {
    if (result && result.accessToken) {
      saveToken(result);
    }
  })
  .catch(console.error);
});

app.on('will-quit', () => {
  if (tokenData.accessToken) {
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData));
  }
});