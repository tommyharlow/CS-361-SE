const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {

    // Media Controls
    const audioPlayer = document.getElementById('audio-player')
    const pausePlayButton = document.getElementById('pause-play')
    const nextButton = document.getElementById('next')
    const prevButton = document.getElementById('prev')
    const repeatButton = document.getElementById('repeat')

    function stopPlaying() {
        songPlaying = false
        progressBar.style.width = '0'
        audioPlayer.pause()
        audioPlayer.src = null
        timeElapsed.innerText = '0:00'
        timeToggleButton.innerText = '0:00'
        updateCover('clear')
        updateMetadata('clear')
    }

    function startPlaying(status) {
        if (status === 'next') {
            currentSong = (currentSong + 1) % songs.length
        } else if (status === 'prev') {
            currentSong = (currentSong - 1 + songs.length) % songs.length
        }
        audioPlayer.src = songs[currentSong].path
        audioPlayer.play()
        updateCover()
        updateMetadata()
        songPlaying = true
    }

    pausePlayButton.addEventListener('click', () => {
        if (checkSongs() === false) { return } 
        if (!songPlaying) { startPlaying() } 
        else if (audioPlayer.paused) { audioPlayer.play() } 
        else { audioPlayer.pause() }
    })

    nextButton.addEventListener('click', () => {
        if (checkSongs() === false) { return }
        if (songRepeat === 'off') { stopPlaying() }
        else { startPlaying('next') }
    })

    prevButton.addEventListener('click', () => {
        if (checkSongs() === false) { return }
        let now = Date.now()
        if (now - prevButtonClickedAt < 2000) {
            // If the button was clicked less than 2 seconds ago, go to the previous song
            startPlaying('prev')
        } else {
            // Otherwise, restart the current song
            audioPlayer.currentTime = 0
        }
        startPlaying()
        prevButtonClickedAt = now
    })

    function checkSongs() {
        if (!songs.length) {
            ipcRenderer.send('show-dialog', {
                title: 'Songs Not Found',
                message: 'Your music directory has no compatible files or an \ninternal error has occurred.',
                icon: './assets/alert.ico'
            });
            return false
        }
        return true
    }

    // Metadata
    const albumCover = document.getElementById('album-cover-current')
    const songTitle = document.getElementById('song-title')
    const songAlbum = document.getElementById('song-album')
    const songArtist = document.getElementById('song-artist')

    function updateCover(status) {
        if (songs[currentSong].cover) {
            albumCover.src = 'data:image/jpeg;base64,' + songs[currentSong].cover;
        } else {
            albumCover.src = 'default.png';
        }
        if (status === 'clear') { albumCover.src = 'default.png'; }
    }

    function updateMetadata(status) {
        songTitle.innerText = songs[currentSong].title
        songAlbum.innerText = songs[currentSong].album
        songArtist.innerText = songs[currentSong].artist

        if (status === 'clear') {
            songTitle.innerText = 'Song'
            songAlbum.innerText = 'Album'
            songArtist.innerText = ''
        }
    }

    const loadMusicDirButton = document.getElementById('load-music-dir')
    const progressBar = document.getElementById('progress-bar')
    const progressBarContainer = document.getElementById('progress-bar-container')
    const timeElapsed = document.getElementById('time-elapsed')
    const timeToggleButton = document.getElementById('time-toggle')

    let updateInterval = null
    let songPlaying = false
    let songRepeat = 'loop'
    let prevButtonClickedAt = 0
    let displayRemainingTime = false
    let repeatSymbol = ''

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`
    }

    const updateTimeAndProgressBar = () => {
        if (audioPlayer.paused) return;

        const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100
        progressBar.style.width = `${percentage}%`
        timeElapsed.innerText = formatTime(audioPlayer.currentTime)

        if (displayRemainingTime) {
            const remainingTime = audioPlayer.duration - audioPlayer.currentTime
            timeToggleButton.innerText = formatTime(remainingTime)
        } else {
            timeToggleButton.innerText = formatTime(audioPlayer.duration)
        }
    }

    function visualizeQueue(songs) {
        // Find the table body in which you want to insert song rows.
        let tbody = document.querySelector("#queue-table tbody");

        // Iterate over the array of songs.
        songs.forEach(song => {
            // Create a new row for each song.
            let tr = document.createElement("tr");

            // Create and append a cell for the song cover.
            let coverCell = document.createElement("td");
            let img = document.createElement("img");

            if (song.cover !== null) {
                img.src = "data:image/jpeg;base64," + song.cover;
            } else {
                img.src = './default.png';
            }
            img.style.width = "32px";
            img.style.height = "32px";
            coverCell.appendChild(img);
            tr.appendChild(coverCell);

            // Create and append a cell for the song title.
            let titleCell = document.createElement("td");
            titleCell.textContent = song.title;
            tr.appendChild(titleCell);

            // Create and append a cell for the song artist.
            let artistCell = document.createElement("td");
            artistCell.textContent = song.artist;
            tr.appendChild(artistCell);

            // Create and append a cell for the song album.
            let albumCell = document.createElement("td");
            albumCell.className = 'song-album';
            albumCell.textContent = song.album;
            tr.appendChild(albumCell);

            // Create and append a cell for the song duration.
            let durationCell = document.createElement("td");
            durationCell.className = 'song-duration';
            durationCell.textContent = song.duration;
            tr.appendChild(durationCell);

            // Add the new row to the table body.
            tbody.appendChild(tr);
        });

    }

    timeToggleButton.addEventListener('click', () => {
        displayRemainingTime = !displayRemainingTime
    })

    updateInterval = setInterval(updateTimeAndProgressBar, 1000)

    loadMusicDirButton.addEventListener('click', () => {
        ipcRenderer.send('switch-directory')
    })

    progressBarContainer.addEventListener('click', (e) => {
        if (songPlaying) {
            const percentage = e.offsetX / progressBarContainer.offsetWidth
            audioPlayer.currentTime = audioPlayer.duration * percentage
        }    
    })

    audioPlayer.addEventListener('ended', () => {
        switch (songRepeat) {
            case 'off':
                // If it's the last song in the playlist, stop playing
                if (currentSong + 1 === songs.length) {
                    stopPlaying()
                    return // End the function here
                }
                // If it's not the last song, go to the next one
                currentSong++;
                break;
            case 'one':
                // Restart the current song
                audioPlayer.currentTime = 0;
                break;
            case 'loop':
                // Go to the next song, looping back to the start if it's the last one
                currentSong = (currentSong + 1) % songs.length;
                break;
        }
        startPlaying()
    });

    repeatButton.addEventListener('click', () => {
        switch (songRepeat) {
            case 'one':
                repeatSymbol = '󰑗';
                songRepeat = 'off'
                break;
            case 'loop':
                repeatSymbol = '󰑘';
                songRepeat = 'one'
                break;
            case 'off':
                repeatSymbol = '󰑖';
                songRepeat = 'loop'
                break;
        }
        repeatButton.textContent = repeatSymbol;
    });

    ipcRenderer.on('loaded-directory', (event, files) => {
        songs = files
        currentSong = 0
        songPlaying = false
        progressBar.style.width = '0'
        clearInterval(updateInterval)
        updateInterval = setInterval(updateTimeAndProgressBar, 1000)
        stopPlaying()
        visualizeQueue(songs)
    });
})
