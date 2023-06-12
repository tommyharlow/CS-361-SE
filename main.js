const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

Menu.setApplicationMenu(null);

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800, // Default starting width
        height: 600, // Default starting height
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.loadFile('index.html')
}

async function loadDirectory(event){
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
        const dirPath = result.filePaths[0]

        fs.readdir(dirPath, (err, files) => {
            if (err) {
                alert('Something went wrong when trying to load the directory.')
                console.error(err)
                return
            }

            const musicFiles = files
            .filter(file => file.endsWith('.mp3')) // Filer out non-mp3 files
            .map(file => path.join(dirPath, file)) // Combine the directory path with the file name
            event.reply('loaded-music-dir', musicFiles) // Send the music files (array) to the renderer process
        })
    }
}
ipcMain.on('open-music-dir', loadDirectory);
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

app.whenReady().then(() => {
    createWindow()
})
