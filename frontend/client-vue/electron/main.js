
import { app, BrowserWindow } from 'electron'

function crearVentana() {
    const ventana = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    ventana.loadURL('http://localhost:5173')
}

app.whenReady().then(() => {
    crearVentana()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            crearVentana()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
