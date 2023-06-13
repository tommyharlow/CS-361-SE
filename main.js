const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

ipcMain.on('show-context-menu', (event, index) => {
    const menu = Menu.buildFromTemplate([
        {
            label: 'Play Now',
            click: () => {
                event.sender.send('context-menu-command', 'play', index);
            }
        },
        {
            label: 'Remove from Queue',
            click: () => {
                event.sender.send('context-menu-command', 'remove', index);
            }
        },
    ]);

    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: win });
});

async function getMusicMetadata(paths) {
    try {
        const musicMetadata = await import('music-metadata');
        const { parseFile } = musicMetadata;
        const songs = [];

        for(let i = 0; i < paths.length; i++) {
            const path = paths[i];
            try {
                const metadata = await parseFile(path, { native: true });

                let cover = null;
                const tagVersions = ['ID3v2.4', 'ID3v2.3', 'ID3v1'];
                for(let tag of tagVersions) {
                    if(metadata.native[tag]) {
                        const pic = metadata.native[tag].find(p => p.id === 'APIC' || p.id === 'PIC');
                        if(pic) {
                            cover = pic.value.data.toString('base64');
                            break;
                        }
                    }
                }

                const duration = metadata.format.duration;
                const formattedDuration = `${Math.floor(duration / 60)}:${('0' + Math.floor(duration % 60)).slice(-2)}`;

                const song = {
                    title: metadata.common.title,
                    album: metadata.common.album,
                    artist: metadata.common.artist,
                    duration: formattedDuration,
                    cover: cover,
                    path: path
                };

                songs.push(song);

            } catch(err) {
                console.error(`Failed to parse file ${path}`, err);
            }
        }

        return songs;

    } catch(err) {
        console.error('Failed to load music-metadata', err);
    }
}

const userProfilePath = path.join(app.getPath('userData'), 'user-profile.ini');

function getMP3Paths(directory) {
    const files = fs.readdirSync(directory);
    const mp3Files = files.filter(file => path.extname(file) === '.mp3');
    return mp3Files.map(file => path.join(directory, file));
}

function updateProfile(directory) {
    const musicDirLine = `music-dir ${directory}`;
    fs.writeFileSync(userProfilePath, musicDirLine);
}

function getDirectory() {
    if (!fs.existsSync(userProfilePath)) return null;

    const profileContent = fs.readFileSync(userProfilePath, 'utf-8');
    const match = profileContent.match(/music-dir (.*)/);

    return match ? match[1] : null;
}

function loadSongs(win) {
    dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        .then(async result => {
            if (!result.canceled && result.filePaths.length > 0) {
                const selectedDirectory = result.filePaths[0];
                const mp3Paths = getMP3Paths(selectedDirectory);
                updateProfile(selectedDirectory);
                console.log(mp3Paths);
                songs = await getMusicMetadata(mp3Paths);
                win.webContents.send('loaded-directory', songs);
            }
        });
}

ipcMain.on('switch-directory', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) loadSongs(win);
});

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');

    win.webContents.on('did-finish-load', async () => {
        const directory = getDirectory();
        if (directory) {
            const mp3Paths = getMP3Paths(directory);
            songs = await getMusicMetadata(mp3Paths);
            win.webContents.send('loaded-directory', songs);
        }
    });
}

const menu = Menu.buildFromTemplate([
    {
        label: 'File',
        submenu: [
            {
                label: 'Load Songs',
                accelerator: 'CmdOrCtrl+L',
                click: () => {
                    const win = BrowserWindow.getFocusedWindow();
                    if (win) loadSongs(win);
                }
            },
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => app.quit()
            }
        ]
    }
]);

//Menu.setApplicationMenu(menu);

ipcMain.on('show-dialog', (event, arg) => {
    dialog.showMessageBox({
        title: arg.title,
        message: arg.message,
        icon: arg.icon
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.whenReady().then(createWindow);
