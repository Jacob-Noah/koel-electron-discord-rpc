const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  const checkSongInfo = () => {
    try {
      // These selectors need to match Koel's actual DOM structure
      const songTitle = document.querySelector('.song-info .meta .title')?.textContent;
      const artist = document.querySelector('.song-info .meta .artist')?.textContent;

      // Album URL is in style attribute with an ID so must be extracted with regex
      // Example: style="--63711e8c: url(https://koel.web.site/img/covers/91dc5cf201294efbd1ba44420b6d10b896ed16ef.webp);"
      const albumCover = document.querySelector('.song-info');
      const albumStyle = albumCover ? albumCover.getAttribute('style') : '';
      const albumMatch = albumStyle.match(/url\(([^)]+)\)/);
      const album = albumMatch ? albumMatch[1] : null;

      const albumTitle = document.querySelector('#extraPanelAlbum .aside h3')?.textContent;

      // Get current time and duration from the actual audio element
      const audioElement = document.querySelector('.plyr--audio audio');
      let currentTime = 0;
      let duration = 0;

      // <audio>.currentTime is in seconds but can be NaN or Infinity
      if (audioElement) {
        if (typeof audioElement.currentTime === 'number' && isFinite(audioElement.currentTime)) {
          currentTime = audioElement.currentTime;
        }
        if (typeof audioElement.duration === 'number' && isFinite(audioElement.duration) && audioElement.duration > 0) {
          duration = audioElement.duration;
        }
      }

      const player = document.querySelector('.plyr--audio');
      const isPlaying = player && player.classList.contains('plyr--playing');
      const isStopped = player && player.classList.contains('plyr--stopped');

      if (songTitle) {
        ipcRenderer.send('song-update', {
          title: songTitle,
          artist: artist || 'Unknown Artist',
          albumIconUrl: album,
          albumTitle,
          currentTime,
          duration,
          isPlaying,
          isStopped
        });
      }
    } catch (err) {
      console.error('Error fetching song info:', err);
    }
  };

  // Check for song info every second
  setInterval(checkSongInfo, 1000);
});