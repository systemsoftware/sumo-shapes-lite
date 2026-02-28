const { contextBridge, ipcRenderer } = require('electron')

let playerCount = 0

ipcRenderer.on('newPlayer', (event, data) => {
if(!document.getElementById('players')) return
if(document.getElementById('noPlayers')) document.getElementById('noPlayers').remove()
const newPlayerP = document.createElement('p')
newPlayerP.textContent = data.name
newPlayerP.id = data.id
document.getElementById('players').appendChild(newPlayerP)
playerCount++
})

ipcRenderer.on('players', (event, data) => {
    if(!document.getElementById('players')) return
    if(document.getElementById('noPlayers')) document.getElementById('noPlayers').remove()
    data.forEach(player => {
        const newPlayerP = document.createElement('p')
        newPlayerP.textContent = player.name
        newPlayerP.id = player.id
        document.getElementById('players').appendChild(newPlayerP)
        playerCount++
    })
    })

ipcRenderer.on('playerDisconnected', (event, data) => {
if(!document.getElementById('players')) return
document.getElementById('players').removeChild(document.getElementById(data))
playerCount--
if(playerCount == 0){ 
    const noPlayers = document.createElement('p')
    noPlayers.textContent = 'No players connected'
    noPlayers.id = 'noPlayers'
    document.getElementById('players').appendChild(noPlayers)
}
})

contextBridge.exposeInMainWorld('electron', {
   getIP: () => {
       return ipcRenderer.sendSync('getIP')
   },
   openGame: () => {
       ipcRenderer.send('openGame')
   },
   playDefault: () => {
    ipcRenderer.send('playDefault')
},
   getSettings: () => {
         return ipcRenderer.sendSync('getSettings')
   },
   saveSettings: (data) => {
       ipcRenderer.send('saveSettings', data)
   },
   openSettings: () => {
       ipcRenderer.send('openSettings')
   },
   sendReload: () => {
       ipcRenderer.send('reload')
   },
   openFile: (file) => {
       ipcRenderer.send('openFile', file)
   },
   removeMusic: () => {
       ipcRenderer.send('removeMusic')
   },
   removeSound: () => {
       ipcRenderer.send('removeSound')
   },
   exitController: () => {
       ipcRenderer.send('exitController')
   },
   openStageBuilder: () => {
       ipcRenderer.send('openStageBuilder')
   },
   menu: () => {
       ipcRenderer.send('menu')
   },
   save:(data) => {
         ipcRenderer.send('save', data)
   },
   playCustom: () => {
       ipcRenderer.send('playCustom')
   },
   findStage: () => {
       ipcRenderer.send('findStage')
   },
   publishStage: (data) => {
         ipcRenderer.send('publishStage')
    },
    quit:() => {
        ipcRenderer.send('quit')
    },
    playAgain: () => {
        ipcRenderer.send('playAgain')
    },
    players: () => {
       return ipcRenderer.sendSync('players')
    },
    playStage: (u,r) => {
        ipcRenderer.send('playStage', u,r)
    },
    playStageObj: (data) => {
        ipcRenderer.send('playStageObj', data)
    },
    clearCustomStage: () => {
        ipcRenderer.send('clearCustomStage')
    },
    toggleRPC: () => {
        ipcRenderer.send('toggleRPC')
    },
    devTools: () => {
        ipcRenderer.send('devTools')
    },
    homedir: () => {
        return ipcRenderer.sendSync('homedir')
    },
    openConsole: () => {
      return alert('This feature is only available in the full version of the game')
    },
    socketAdmin: () => {
       return alert('This feature is only available in the full version of the game')
    },
    openURL: (url) => {
        ipcRenderer.send('openURL', url)
    },
    })