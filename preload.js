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
    const albumCoverNext = document.getElementById('album-cover-next')
    const songTitle = document.getElementById('song-title')
    const songAlbum = document.getElementById('song-album')
    const songArtist = document.getElementById('song-artist')
    const songTitleNext = document.getElementById('song-title-next')


    function updateCover(status) {
        if (songs[currentSong].cover) {
            albumCover.src = 'data:image/jpeg;base64,' + songs[currentSong].cover;
        } else {
            albumCover.src = 'default.png';
        }

        if (status === 'clear') { 
            albumCover.src = 'default.png';
            albumCoverNext.src = 'default.png';
        } else {
            // Use the modulo operator to loop back to the start of the songs array when we reach the end.
            let nextSongIndex = (currentSong + 1) % songs.length;

            switch (songRepeat) {
                case 'one':
                    albumCoverNext.src = 'default.png';
                    break;
                case 'loop':
                    if (songs[nextSongIndex].cover) {
                        albumCoverNext.src = 'data:image/jpeg;base64,' + songs[nextSongIndex].cover;
                    } else {
                        albumCoverNext.src = 'default.png';
                    }
                    break;
                default:
                    // For 'off', show the next cover until the last song, then show default
                    if (currentSong === songs.length - 1) {
                        albumCoverNext.src = 'default.png';
                    } else if (songs[nextSongIndex].cover) {
                        albumCoverNext.src = 'data:image/jpeg;base64,' + songs[nextSongIndex].cover;
                    } else {
                        albumCoverNext.src = 'default.png';
                    }
                    break;
            }
        }
    }

    function updateMetadata(status) {
        let nextSongIndex = (currentSong + 1) % songs.length;

        songTitle.innerText = songs[currentSong].title
        songAlbum.innerText = songs[currentSong].album
        songArtist.innerText = songs[currentSong].artist

        switch (songRepeat) {
            case 'one':
                songTitleNext.innerText = ''
                break;
            case 'loop':
                songTitleNext.innerText = songs[nextSongIndex].title;
                break;
            default: // 'off'
                if (currentSong === songs.length - 1) {
                    songTitleNext.innerText = 'Next Song';
                } else {
                    songTitleNext.innerText = songs[nextSongIndex].title;
                }
                break;
        }

        if (status === 'clear') {
            songTitle.innerText = 'Song'
            songAlbum.innerText = 'Album'
            songArtist.innerText = ''
            songTitleNext.innerText = 'Next Song'
        }
    }


    const loadMusicDirButton = document.getElementById('load-music-dir')
    const progressBar = document.getElementById('progress-bar')
    const progressBarContainer = document.getElementById('progress-bar-container')
    const timeElapsed = document.getElementById('time-elapsed')
    const timeToggleButton = document.getElementById('time-toggle')
    const shuffleButton = document.getElementById('shuffle')

    let updateInterval = null
    let songPlaying = false
    let songRepeat = 'loop'
    let prevButtonClickedAt = 0
    let displayRemainingTime = false
    let repeatSymbol = ''
    let queueBackup = []
    let searchInput = document.getElementById("searchInput");
    let searchCancelButton = document.getElementById("searchCancelButton");
    let debounceTimeout;

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

    searchInput.addEventListener("input", (e) => {
        // Clear any existing timeouts.
        clearTimeout(debounceTimeout);

        // Start a new timeout. If the user types again before the timeout finishes,
        // the timeout will be cleared and a new one will start.
        debounceTimeout = setTimeout(() => {
            // Clear the current contents of the table.
            let tbody = document.querySelector("#queue-table tbody");
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }

            // Filter the songs based on the input.
            let searchTerm = e.target.value;
            let filteredSongs = songs.filter(song => {
                return song.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                    song.artist.toLowerCase().includes(searchTerm.toLowerCase());
            });

            // Visualize the filtered list of songs.
            visualizeQueue(filteredSongs);
        }, 500); // The number of milliseconds to wait before running the function. You can adjust this value as needed.
    });

    searchCancelButton.addEventListener("click", (e) => {
        // Clear any existing timeouts.
        clearTimeout(debounceTimeout);

        // Clear the search input.
        searchInput.value = '';

        // Clear the current contents of the table.
        let tbody = document.querySelector("#queue-table tbody");
        while (tbody.firstChild) {
            tbody.removeChild(tbody.firstChild);
        }

        // Visualize the original list of songs.
        visualizeQueue(songs);
    });

    function visualizeQueue(songs) {
        // Find the table body in which you want to insert song rows.
        let tbody = document.querySelector("#queue-table tbody");

        // Iterate over the array of songs.
        songs.forEach((song, index) => {
            // Create a new row for each song.
            let tr = document.createElement("tr");
            tr.dataset.songId = index;

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

            tr.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Here we directly send the songId from the tr element.
                ipcRenderer.send('show-context-menu', tr.dataset.songId); 
            });

            tr.addEventListener('click', (e) => {
                e.preventDefault();
                currentSong = tr.dataset.songId;
                startPlaying();
            });

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

    shuffleButton.addEventListener('click', () => {
        shuffleSongs();
        updateMetadata();
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

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function shuffleSongs() {
        // Save the current song.
        let current = songs[currentSong];

        // Shuffle the songs array.
        shuffle(songs);

        // Update currentSong to match the new position of the current song.
        currentSong = songs.indexOf(current);

        // Clear the old table.
        document.querySelector("#queue-table tbody").innerHTML = "";

        // Draw the new table.
        visualizeQueue(songs);
    }


    function removeFromQueue(index) {
        console.log("Index passed to removeFromQueue:", index);
        console.log("querySelector string: ", `#queue-table tbody tr[data-song-id='${index}']`);

        if (queueBackup === []) {
            queueBackup = songs;
        }

        // Remove the corresponding row from the table.
        let rowToRemove = document.querySelector(`#queue-table tbody tr[data-song-id='${index}']`);
        console.log("Selected row: ", rowToRemove);
        rowToRemove.remove();

        // Splice removes the item at the given index.
        songs.splice(index, 1);

        // Update indices of all subsequent rows.
        let rowsToUpdate = Array.from(document.querySelectorAll(`#queue-table tbody tr[data-song-id]`))
        .filter(row => Number(row.dataset.songId) > index);

        for (let row of rowsToUpdate) {
            row.dataset.songId = Number(row.dataset.songId) - 1;
        }
    }

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

    ipcRenderer.on('context-menu-command', (event, command, index) => {
        switch (command) {
            case 'play':
                currentSong = index;
                startPlaying();
                break;
            case 'remove':
                // Call your function to remove the song from the queue.
                removeFromQueue(index);
                break;
        }
    });


})
