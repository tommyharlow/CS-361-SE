const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }

    // Start of MP3 Player logic

    const loadMusicDirButton = document.getElementById('load-music-dir')
    const pausePlayButton = document.getElementById('pause-play')
    const nextButton = document.getElementById('next')
    const prevButton = document.getElementById('prev')
    const repeatButton = document.getElementById('repeat')
    const progressBar = document.getElementById('progress-bar')
    const progressBarContainer = document.getElementById('progress-bar-container')
    const audioPlayer = document.getElementById('audio-player')
    const timeElapsed = document.getElementById('time-elapsed')
    const timeToggleButton = document.getElementById('time-toggle')

    let updateInterval = null
    let musicFiles = []
    let currentFileIndex = 0
    let songLoaded = false
    let songRepeat = 'off'
    let prevButtonClickedAt = 0
    let displayRemainingTime = false

    const formatTime = (time) => {
        const minutes = Math.floor(time / 60)
        const seconds = Math.floor(time % 60)
        return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`
    }

    const updateTimeAndProgressBar = () => {
        if(audioPlayer.paused) return;

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

    timeToggleButton.addEventListener('click', () => {
        displayRemainingTime = !displayRemainingTime
    })

    updateInterval = setInterval(updateTimeAndProgressBar, 1000)

    loadMusicDirButton.addEventListener('click', () => {
        ipcRenderer.send('open-music-dir')
    })

    progressBarContainer.addEventListener('click', (e) => {
        if (songLoaded) {
            const percentage = e.offsetX / progressBarContainer.offsetWidth
            audioPlayer.currentTime = audioPlayer.duration * percentage
        }    
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
            pausePlayButton.
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
        switch (songRepeat) {
            case 'off':
                // If it's the last song in the playlist, stop playing
                if (currentFileIndex + 1 === musicFiles.length) {
                    audioPlayer.pause();
                    songLoaded = false; // Set the song as unloaded
                    progressBar.style.width = '0'; // Reset the progress bar
                    return; // End the function here
                }

                // If it's not the last song, go to the next one
                currentFileIndex++;
                break;
            case 'one':
                // Restart the current song
                audioPlayer.currentTime = 0;
                break;
            case 'loop':
                // Go to the next song, looping back to the start if it's the last one
                currentFileIndex = (currentFileIndex + 1) % musicFiles.length;
                break;
        }

        // Set and play the new song, and reset the progress bar
        audioPlayer.src = musicFiles[currentFileIndex];
        audioPlayer.play();
        progressBar.style.width = '0';
    });


    repeatButton.addEventListener('click', () => {
        switch (songRepeat) {
            case 'off':
                songRepeat = 'one';
                break;
            case 'one':
                songRepeat = 'loop';
                break;
            case 'loop':
                songRepeat = 'off';
                break;
        }
        repeatButton.textContent = `Repeat: ${songRepeat}`; // Change the text of the button
    });

    ipcRenderer.on('loaded-music-dir', (event, files) => {
        musicFiles = files
        currentFileIndex = 0
        songLoaded = false // Reset this variable when a new directory is loaded
        progressBar.style.width = '0'
        clearInterval(updateInterval)
        updateInterval = setInterval(updateTimeAndProgressBar, 1000)
    });
})
