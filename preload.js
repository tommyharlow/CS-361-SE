const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }

    // end of old code

    const loadMusicDirButton = document.getElementById('load-music-dir')
    const pausePlayButton = document.getElementById('pause-play')
    const nextButton = document.getElementById('next')
    const prevButton = document.getElementById('prev')
    const repeatButton = document.getElementById('repeat')
    const audioPlayer = document.getElementById('audio-player')

    let musicFiles = []
    let currentFileIndex = 0
    let songLoaded = false
    let songRepeat = false
    let prevButtonClickedAt = 0

    loadMusicDirButton.addEventListener('click', () => {
        ipcRenderer.send('open-music-dir')
    })

    pausePlayButton.addEventListener('click', () => {
        if (!musicFiles.length) {
            alert('dir_not_set or no_songs_found')
            return
        }

        if (!songLoaded) {
            audioPlayer.src = musicFiles[currentFileIndex]
            audioPlayer.play()
            songLoaded = true
        } else if (audioPlayer.paused) {
            audioPlayer.play()
        } else {
            audioPlayer.pause()
        }
    })

    nextButton.addEventListener('click', () => {
        if (!musicFiles.length) {
            alert('dir_not_set or no_songs_found')
            return
        }

        currentFileIndex = (currentFileIndex + 1) % musicFiles.length
        audioPlayer.src = musicFiles[currentFileIndex]
        audioPlayer.play()
        songLoaded = true
    })

    prevButton.addEventListener('click', () => {
        if (!musicFiles.length) {
            alert('dir_not_set or no_songs_found')
            return
        }

        let now = Date.now()
        if (now - prevButtonClickedAt < 2000) {
            // If the button was clicked less than 2 seconds ago, go to the previous song
            currentFileIndex = (currentFileIndex - 1 + musicFiles.length) % musicFiles.length
        } else {
            // Otherwise, restart the current song
            audioPlayer.currentTime = 0
        }
        audioPlayer.src = musicFiles[currentFileIndex]
        audioPlayer.play()
        songLoaded = true

        prevButtonClickedAt = now
    })

    audioPlayer.addEventListener('ended', () => {
        if (songRepeat) {
            audioPlayer.currentTime = 0 // Restart the song to the beginning
            audioPlayer.play() // Just in case the song doesn't restart, unneeded
        }
    })

    repeatButton.addEventListener('click', () => {
        songRepeat = !songRepeat // Toggle the variable
        repeatButton.textContent = songRepeat ? "Repeat On" : "Repeat Off" // Change the text of the button
    })

    ipcRenderer.on('loaded-music-dir', (event, files) => {
        musicFiles = files
        currentFileIndex = 0
        songLoaded = false // Reset this variable when a new directory is loaded
    })


})
