import { app, BrowserWindow, ipcMain } from 'electron';
import { Client } from "@xhayper/discord-rpc";
import { ActivityType } from 'discord-api-types/v10';
import path from 'path';
import fs from 'fs';
import config from './config.json' with { type: 'json'};

const __dirname = import.meta.dirname;
const client = new Client({ 'clientId': config.clientId, 'transport': 'ipc' });

// Path for storing tokens
const tokenPath = path.join(app.getPath('userData'), 'discord_token.json');

// Token storage
let tokenData = {
  accessToken: null,
  expiresAt: 0
};

let lastSentActivityData = null;
let isIdling = false;
let idleTimer = null;

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
  title: '',
  artist: '',
  albumIconUrl: '',
  albumTitle: '',
  startTimestamp: null,
  duration: 0
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
ipcMain.on('song-update', async (event, songInfo) => {
  const songTitle = songInfo.title || '';
  const albumTitle = songInfo.albumTitle || '';
  const isPlaying = songInfo.isPlaying;
  const isStopped = songInfo.isStopped;

  const songLoaded = songTitle && albumTitle;
  const wasPreviouslyIdling = isIdling;
  const wasPreviouslyPausedWithTimer = !!idleTimer;

  if (isPlaying && songLoaded) {

    // New song
    if (currentSong.title !== songTitle || currentSong.albumTitle !== albumTitle) {
      console.log('New song detected:', songTitle);
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      isIdling = false; 
      currentSong = {
        title: songTitle,
        artist: songInfo.artist || 'Unknown Artist',
        albumIconUrl: songInfo.albumIconUrl || 'logo',
        albumTitle: albumTitle,
        startTimestamp: (songInfo.currentTime && songInfo.duration > 0) ? (Date.now() - (songInfo.currentTime * 1000)) : null,
        duration: songInfo.duration || 0
      };
      await updateDiscordActivity(true);

    // Same song (resumed from idle or paused)
    } else {
      if (wasPreviouslyIdling || wasPreviouslyPausedWithTimer) {
        console.log('Resuming playback of song:', songTitle);
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        isIdling = false;
        // Recalculate timestamps
        currentSong.startTimestamp = (songInfo.currentTime && songInfo.duration > 0) ? (Date.now() - (songInfo.currentTime * 1000)) : null;
        currentSong.duration = songInfo.duration || currentSong.duration || 0;
        await updateDiscordActivity(true);
      }
    }

  // Paused while a song was loaded & current
  } else if (isStopped && currentSong.title) {
    if (!idleTimer && !isIdling) {
      console.log('Player paused with song:', currentSong.title, '. Setting PAUSED activity (no timeline).');
      // Force update to show paused state (song info without timeline)
      await updateDiscordActivity(true, false); 

      console.log('Starting idle timer for paused song.');
      idleTimer = setTimeout(async () => {
        console.log('Idle timer expired for paused song, transitioning to full idle activity.');
        await setIdleActivity();
        idleTimer = null;
      }, config.idleTimeout);
    }

  // Not playng (no song, song ended, initial load, or invalid)
  } else {
    if (currentSong.title || !isIdling) {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      await setIdleActivity();
    }
  }
});

// Set idle/browsing activity
async function setIdleActivity() {
  if (!client.user) return;

  const idlePayload = {
    details: 'Browsing Koel',
    state: 'Looking for music...',
    largeImageKey: 'logo',
    largeImageText: 'Koel',
    instance: true,
  };
  const idlePayloadString = JSON.stringify(idlePayload);
  if (isIdling && lastSentActivityData === idlePayloadString) {
    return;
  }

  console.log('Setting idle Discord activity');
  try {
    await client.user.setActivity(idlePayload);
    lastSentActivityData = idlePayloadString; 
    isIdling = true;
    currentSong = {
      title: '', artist: '', albumIconUrl: '', albumTitle: '',
      startTimestamp: null, duration: 0
    };
  } catch (error) {
    console.error('Failed to set idle activity:', error);
  }
}

// Update Discord activity with new song
async function updateDiscordActivity(forceUpdate = false, includeTimestamps = true) { // Added includeTimestamps parameter
  if (!client.user) return;

  if (!currentSong.title) {
    await setIdleActivity();
    return;
  }

  isIdling = false;

  const activityData = {
    type: ActivityType.Listening,
    details: currentSong.title,
    state: `by ${currentSong.artist}`,
    largeImageKey: currentSong.albumIconUrl || 'logo',
    largeImageText: currentSong.albumTitle || 'Koel',
    smallImageKey: 'playing',
    smallImageText: currentSong.artist ? `Listening to ${currentSong.artist}` : 'Playing on Koel',
    instance: true,
  };

  if (includeTimestamps && currentSong.startTimestamp && currentSong.duration > 0) {
    activityData.startTimestamp = currentSong.startTimestamp;
    activityData.endTimestamp = currentSong.startTimestamp + (currentSong.duration * 1000);
  }
  const activityDataString = JSON.stringify(activityData);
  if (lastSentActivityData === activityDataString && !forceUpdate) {
    return;
  }

  console.log(`Updating Discord activity with song: ${currentSong.title} (Force: ${forceUpdate}, Timestamps: ${includeTimestamps})`);
  try {
    await client.user.setActivity(activityData);
    lastSentActivityData = activityDataString; 
  } catch (error) {
    console.error('Failed to push song activity update:', error);
  }
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