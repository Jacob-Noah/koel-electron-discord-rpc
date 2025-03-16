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

      // Get current time and duration via seek range
      const timeRange = document.querySelector('.plyr__progress .plyr__progress-seek');
      const currentTime = timeRange ? timeRange.value : 0;
      const duration = timeRange ? timeRange.max : 0;

      if (songTitle) {
        ipcRenderer.send('song-update', {
          title: songTitle,
          artist: artist || 'Unknown Artist',
          albumIconUrl: album,
          albumTitle,
          currentTime,
          duration
        });
      }
    } catch (err) {
      console.error('Error fetching song info:', err);
    }
  };

  // Check for song info every second
  setInterval(checkSongInfo, 1000);
});