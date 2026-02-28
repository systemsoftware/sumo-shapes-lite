// set up express and socket.io
const express = require('express');
const app = express();
const server = require('http').Server(app);
const fs = require('fs');
const electron = require('electron');
const os = require('os');
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let override = null

let players = []

const appPath = fs.existsSync(electron.app.getPath('userData').replace('-lite', '')) ? electron.app.getPath('userData').replace('-lite', '') : electron.app.getPath('userData');

if(!fs.existsSync(`${appPath}/config.json`)) fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ 
    WARNING:"Do not change the values of this file unless you know what you are doing. You must restart the app after changing the values.",
    speed: 2, port: 3000, jumpForce:8, lives:3 }, null, 2));

console.log(appPath)

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    throw new Error('No external IPv4 address found');
}

let lockedGame = false;

let playingOnThis = false

const time = Date.now();

const id = electron.powerSaveBlocker.start('prevent-display-sleep');

electron.app.on("before-quit", () => {
    electron.powerSaveBlocker.stop(id);
})


electron.app.on('ready', async () => {
    let { bg_music, hit_sound, port, speed } = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    if(bg_music && !fs.existsSync(bg_music)) electron.dialog.showErrorBox('Error', 'Background music file not found. Please check the path in the settings and restart the app.');
    if(hit_sound && !fs.existsSync(hit_sound)) electron.dialog.showErrorBox('Error', 'Hit sound file not found. Please check the path in the settings and restart the app.');

    electron.app.setName("Sumo Shapes")

    require('dns').lookup('google.com', async (err) => { 
        if (err && err.code == "ENOTFOUND") {
            console.log('No internet connection');
            electron.dialog.showErrorBox('Error', 'No internet connection. Please connect to the internet and restart the app.');
            return electron.app.quit()
        }
    })

    const configAtInit = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));

    const win = new electron.BrowserWindow({
        width:  configAtInit.windowWidth || electron.screen.getPrimaryDisplay().workAreaSize.width,
        height: configAtInit.windothHeight || electron.screen.getPrimaryDisplay().workAreaSize.height,
        x: configAtInit.windowX || 0,
        y: configAtInit.windowY || 0,
        resizable:true,
        webPreferences: {
    preload: __dirname + '/preload.js'
        },
        titleBarStyle: configAtInit.titlebarStyle ? configAtInit.titlebarStyle : 'hiddenInset',
    });
    


win.webContents.setUserAgent('Sumo Shapes Client v' + require('./package.json').version);

if(process.argv.includes('--dev')) win.webContents.openDevTools();

let client = new (require('discord-rpc-revamp').Client)();
client.connect({ clientId: '1284607172164194457' }).catch(console.error);

const RPC_ACTION = (RPC_OVERRIDE) => {
    if(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).disableRPC) return;
    const type = win.webContents.getURL().split('/').pop();
    let string = RPC_OVERRIDE ?? ''
    console.log(type)
    if(!RPC_OVERRIDE){
    switch(type){
        case 'started.html':
            string = 'In the main menu';
            break;
        case 'builder.html':
            string = 'Building a custom stage';
            break;
        case 'findstage.html':
            string = 'Finding a custom stage';
            break;
           case 'settings.html':
            string = 'Configuring the game';
            break;
        default:
            string = `Hosting a ${players.length} player game`;
            break;
    }
}
console.log('string: ',string)
    client.setActivity({
        details: string,
        startTimestamp: time,
        largeImageKey: 'shapes',
    }).then(_ => console.log('set activity')).catch(console.error);
}

client.on('ready', _ => {
    if(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).disableRPC) return;
    RPC_ACTION('In the main menu');
});

electron.app.setAboutPanelOptions({
    "applicationName": "Sumo Shapes",
    "applicationVersion": require('./package.json').version,
    "version": require('./package.json').version,
    "authors": ["CoolStone Technologies"],
    copyright: "© 2024 CoolStone Technologies",
    "website": "https://coolstone.dev"
})

let controllerW

const menu = electron.Menu.buildFromTemplate([
    {
      label:"App",
      submenu:[
        {
           role:"about",
        },
        { label:"Credits", click: () => { win.loadFile('credits.html') } },
        { type:"separator" },
        {
            role: 'quit',
            label: 'Quit'
        }
      ]  
    },
    {
        label:"Window",
        submenu:[
            {
                label: 'Minimize',
                role: 'minimize'
            },
            {
                label: 'Close',
                role: 'close'
            },
            {
                label:"Hide",
                role: 'hide'
            },
        {
            role: "togglefullscreen",
        }
        ]
    },
    {
        label: 'Game',
        submenu: [
            {
                type:"checkbox",
                checked:lockedGame,
                label:"Lock Game",
                click: () => {
                    lockedGame = !lockedGame;
                    io.emit('lock', lockedGame);
                }
            },
            {
                type:"separator"
            },
            {
                label: 'Show IP',
                click: () => {
                    electron.dialog.showMessageBox(win, {
                        type: 'info',
                        title: 'IP Address',
                        message: `Your IP Address is ${getLocalIPAddress()}:${port || 3000}`
                    });
                }
            },
            {
                type: 'separator'
            },
            {
                label:"Restart",
                role: 'reload',
            },
            {
                type:"separator"
            },
            {
                label:"Play on this Device",
                click(){
                    if(playingOnThis) return electron.dialog.showErrorBox('Error', 'You are already playing on this device');
                    playingOnThis = true;
                    controllerW = new electron.BrowserWindow({
                        width: 550,
                        height: electron.screen.getPrimaryDisplay().workAreaSize.height,
                        webPreferences: {
                            preload: __dirname + '/preload.js'
                        },
                        x: electron.screen.getPrimaryDisplay().workAreaSize.width - 550,
                        y: 0
                    });
                    controllerW.webContents.setUserAgent('Sumo Shapes Client v' + require('./package.json').version);
                    controllerW.loadURL(`http://localhost:${port || 3000}`);
                    controllerW.on('close', () => {
                        console.log('Controller closed');
                        playingOnThis = false;
                    })
                }
            }
        ]
    },
    {
        label: 'View',
        submenu:[
            {
                label:"Game View",
                click: () => {
                    win.loadURL(`http://localhost:${port || 3000}/g`);
                }
            },
            {
                label:"Main Menu",
                click: () => {
                    win.loadFile('started.html');
                }
            },
            {
                label: 'Settings',
                click: () => {
                    win.loadFile('settings.html');
                }
            },
            {
                label:"Custom Stages",
                type:"submenu",
                submenu:[
                    {
                        label:"Find Stage",
                        click: () => {
                            win.loadFile('findstage.html');
                        }
                    },
                    {
                        label:"Publish Stage",
                        click: () => {
                            new electron.BrowserWindow({
                                webPreferences:{
                                    preload: __dirname + '/preload.js'
                                }
                            }).loadFile('publish.html');
                        }
                    },
                    {
                        label:"Stage Builder",
                        click: () => {
                            win.loadFile('builder.html');
                        }
                    }
                ]
            }
        ]
    },
    {
        label:"Text",
        submenu:[
            {
               role:"copy"
            },
            {
                role:"paste"
            }
        ]
    }
]);

electron.ipcMain.on('exitController', () => { playingOnThis = false; controllerW.close() });


electron.Menu.setApplicationMenu(menu);

win.on('resize', () => {
    win.reload();
})

win.webContents.on("context-menu", (e, p) => {
    e.preventDefault();
    menu.popup()
})

app.get('/qrcodejs', (req, res) => {
    res.sendFile(require('path').join(require.resolve('qrcodejs'), '../qrcode.min.js'));
})


win.loadFile('started.html');

electron.ipcMain.on('getIP', (event) => {
    event.returnValue = {
        ip: getLocalIPAddress(),
        port: port || 3000,
        v: require('./package.json').version
    }
    })

electron.ipcMain.on('openGame', () => {
    win.loadURL(`http://localhost:${port || 3000}/g`);
    })

electron.ipcMain.on('playDefault', () => {
    override = null
    win.loadURL(`http://localhost:${port || 3000}/g`);
})
    
io.on('connection', (socket) => {
    console.log('A user connected');
    if(socket.handshake.headers.type == 'game'){
        console.log('Game connected');
        io.emit("reload")
    }
    socket.on('join', (data) => {
        if(!socket.handshake.headers.id) return socket.emit('error', 'Could not find your ID');
        if(lockedGame) return socket.emit('error', 'The game is locked');
        const player = {
            id: socket.id,
            photo: data.image || socket.handshake.headers.image,
            color: data.color ??`#${ Math.floor(Math.random()*16777215).toString(16)}`,
            name: data.name,
            shape: data.shape
        }
        console.log(socket.handshake.headers)
        players.push(player);
        io.emit('playerConnected', player);
        io.to(player.id).emit('playerConnected', player);
            win.webContents.send('newPlayer', player);
            if(win.webContents.getURL().endsWith('started.html')) return;
           RPC_ACTION();
    })


    socket.on('disconnect', () => {
        if(socket.handshake.headers.type != 'controller') return;
            io.emit('playerDisconnected', socket.id);
            players = players.filter(p => p.id != socket.id);
            try{
            win.webContents.send('playerDisconnected', socket.id);
            }catch(e){
                console.log(e);
            }
            RPC_ACTION()
    });

    socket.on('move', (data) => {
        let res = { id: socket.id, direction:data, speed };
         res.id = socket.id;
        io.emit('move', res);
    })

    })

    electron.ipcMain.on('getSettings', (event) => {
        event.returnValue = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    })

    electron.ipcMain.on('saveSettings', async (event, data) => {
        let settings = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
        const changedPort = data.port != settings.port;
        const changedConsole = data.console != `${settings.console}`;
        const changedSpeed = data.speed != settings.speed;
        const changedTitleBar = data.titlebarStyle != settings.titlebarStyle;
        const changedSocketioAdmin = data.socketAdmin != settings.socketAdmin;
        const changedAdminUser = data.adminUser != settings.adminUser;
        const CHANGED_SAVE_TYPE = data.storeIn != settings.storeIn;
    
        console.log('New settings', data);

        let changedCount = 0;
    
        Object.keys(data).forEach((key) => {
            if (String(data[key]).length < 0) return console.log('No data to save for ' + key);
            if (key == 'adminPass') data[key] = bcrypt.hashSync(data[key], 10);
            if (data[key] == 'true') data[key] = true;
            if (data[key] == 'false') data[key] = false;
            if (parseInt(data[key])) data[key] = parseInt(data[key]);
            settings[key] = data[key];
            if (settings[key] != data[key]) changedCount++;
        });

        if (settings.disableRPC == true) {
            client.clearActivity().then(_ => console.log('cleared activity')).catch(console.error);
        } else {
            setTimeout(() => {
                RPC_ACTION();
            }, 2000);
        }
    
        fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(settings, null, 2));
    
        if (changedPort || changedConsole || changedSpeed || changedTitleBar || changedSocketioAdmin || changedAdminUser || CHANGED_SAVE_TYPE) {
            let changed = []
            if (changedPort) changed.push('port');
            if (changedConsole) changed.push('console');
            if (changedSpeed) changed.push('speed');
            if (changedTitleBar) changed.push('title bar style');
            if (changedSocketioAdmin) changed.push('Socket.IO Admin UI');
            if (changedAdminUser) changed.push('admin username');
            if (CHANGED_SAVE_TYPE) changed.push('stage storage');
            const d = await electron.dialog.showMessageBox(win, {
                type: 'info',
                message: `You have changed ${changed.join(' ')}, which requires a restart.`,
                buttons: ['Restart', 'Later']
            });
            if (d.response == 0) {
                electron.app.relaunch();
                electron.app.quit();
            }
        } else {
            new electron.Notification({ title: 'Settings saved', body:`Your settings have been saved` }).show();
        }
    
        win.loadFile('started.html');
    });

    electron.ipcMain.on('openSettings', () => {
        win.loadFile('settings.html');
    })

    electron.ipcMain.on('reload', () => {
       io.emit('reload');
    })


    electron.ipcMain.on('playAgain', () => {
    const origLock = lockedGame;
    lockedGame = false;
    win.reload();
    setTimeout(() => {
        lockedGame = origLock;
    }, 1500);
    })


app.get('/g', (req, res) => {
    if(!req.headers['user-agent'].includes('Sumo Shapes')) return res.status(403).send('Use the Sumo Shapes client to play the game');
    let { speed, allowFlight, jumpForce, lives, bg_type, bg_color, bg_img, platform_bg, bg_vol, hit_vol, bg_music, hit_sound, platformWidth, playerSize, powerupFreq, powerupDur, speedBoost, jumpBoost, regainLife, platformFreq } = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    if(isNaN(parseInt(speed))) speed = 2;
    if(isNaN(parseInt(jumpForce))) jumpForce = 8
    console.log(parseInt(lives))
    if(isNaN(lives)) lives = 3;
    if(isNaN(parseInt(bg_vol))) bg_vol = 0.5;
    if(isNaN(parseInt(hit_vol))) hit_vol = 0.5;
    if(isNaN(playerSize)) playerSize = 50;
    if(isNaN(powerupFreq)) powerupFreq = 10;
    if(isNaN(powerupDur)) powerupDur = 10;
    if(isNaN(speedBoost)) speedBoost = 2;
    if(isNaN(jumpBoost)) jumpBoost = 2;
    if(isNaN(platformFreq)) platformFreq = 5;
    if(!bg_type) bg_type = 'color';
    if(!bg_color) bg_color = '#87CEEB'; 
    if(!bg_img) bg_type = 'color';
    if(!platform_bg) platform_bg = '#000000';
    if(!platformWidth) platformWidth = "window"
    let file = fs.readFileSync(__dirname + '/index.html', 'utf8');
    if(override) {
        file = file.replace("'SPEED'", override.speed ?? speed);
        file = file.replace("'JUMP_FORCE'", override.jumpForce ?? jumpForce);
        file = file.replace("'LIVES'", isNaN(override.lives) ? lives : override.lives);
        file = file.replace("'BG'", override.backgroundType == 'color' ? override.backgroundColor : `url("${override.backgroundImage}")`);
        file = file.replace("'PLATFORMS'", JSON.stringify(override.platforms));
        file = file.replace("'BG_MUSIC'", override.bgMusic ?? bg_music);
        file = file.replace("'HIT_SOUND'", override.hitSound ?? hit_sound);
        file = file.replace("'BG_VOL'", bg_vol);
        file = file.replace("'HIT_VOL'", hit_vol);
        file = file.replace("'ALLOW_FLIGHT'", allowFlight || override.allowFlight || false);
        file = file.split("'PLATFORM_BG'").join(platform_bg);
        file = file.split("'IS_CUSTOM'").join('true');
        file = file.split("'PLATFORM_WIDTH'").join((override.platformWidth ?? platformWidth) == 'window' || (override.platformWidth ?? platformWidth) == 'pulse' ? 'window.innerWidth' : (override.platformWidth ?? platformWidth));
        file = file.split("'PLAYER_SIZE'").join(isNaN(override.playerSize) ? playerSize : override.playerSize);
        file = file.split('POWERUP_DURATION').join(override.powerupDur ?? powerupDur);
        file = file.split('POWERUP_FREQ').join(override.powerupFreq ?? powerupFreq);
        file = file.split('SPEED_BOOST').join(override.speedBoost ?? speedBoost);
        file = file.split('JUMP_BOOST').join(override.jumpBoost ?? jumpBoost);
        file = file.split('REGAIN_LIFE').join(override.regainLife ?? regainLife);
        file = file.split('PLATFORM_FREQ').join(override.platformFreq ?? platformFreq);
        file = file.split('BG_COLOR').join(override.backgroundColor ?? bg_color);
        if(override.platformWidth == 'pulse') {
            file = file.split('PULSE_PLATFORM').join('true');
        }else{
            file = file.split('PULSE_PLATFORM').join('false');
        }
    }else{
    file = file.split("'SPEED'").join(speed).split("'JUMP_FORCE'").join(jumpForce).split("'LIVES'").join(lives).split("'BG'").join(bg_type == 'color' ? bg_color : `url("${bg_img}")`).split("'PLATFORM_BG'").join(platform_bg).split("'BG_MUSIC'").join(bg_music).split("'HIT_SOUND'").join(hit_sound).split("'BG_VOL'").join(bg_vol).split("'HIT_VOL'").join(hit_vol).split("'ALLOW_FLIGHT'").join(allowFlight).split("'IS_CUSTOM'").join('false').split("'PLATFORM_WIDTH'").join(platformWidth == 'window' ? 'window.innerWidth' : platformWidth == 'pulse' ? 'window.innerWidth' : platformWidth).split("'PLAYER_SIZE'").join(playerSize).split('POWERUP_DURATION').join(powerupDur).split('POWERUP_FREQ').join(powerupFreq).split('SPEED_BOOST').join(speedBoost).split('JUMP_BOOST').join(jumpBoost).split('REGAIN_LIFE').join(regainLife).split('PLATFORM_FREQ').join(platformFreq).split('BG_COLOR').join(bg_color);
    if(platformWidth == 'pulse') {
        file = file.split('PULSE_PLATFORM').join('true');
    }else{
        file = file.split('PULSE_PLATFORM').join('false');
    }
    }
    file = file.replace("'LOCKED'", lockedGame);
   res.send(file);
 })

 electron.ipcMain.on('openFile', (event) => {
    electron.shell.openPath(`${appPath}/config.json`);
})

electron.ipcMain.on('players', (event) => {
    event.returnValue = players;
})

electron.ipcMain.emit('players', players);

electron.ipcMain.on('removeMusic', () => {
    let s = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    s.bg_music = ''
    fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(s, null, 2));
    new electron.Notification({ title: 'Background music removed', body: 'Background music has been removed.' }).show();
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Background music removed.' });
})

electron.ipcMain.on('removeSound', () => {
    let s = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8'));
    s.hit_sound = ''
    fs.writeFileSync(`${appPath}/config.json`, JSON.stringify(s, null, 2));
    new electron.Notification({ title: 'Hit sound removed', body: 'Hit sound has been removed.', actions:[ { text:"Close" } ] }).show();
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Hit sound removed.' });
})

electron.ipcMain.on('openStageBuilder', () => {
    win.loadFile('builder.html');
})

electron.ipcMain.on('menu', () => {
    win.loadFile('started.html');
})

electron.ipcMain.on('save', (event, data) => {
    data.updated = Date.now();
    electron.dialog.showSaveDialog(win, {
        title: 'Save Game Data',
        defaultPath: `sumo-shapes-stage-${Date.now()}.json`,
        filters: [
            { name: 'JSON', extensions: ['json'] }
        ]
    }).then(async (file) => {
        if(file.canceled) return;
        fs.writeFileSync(file.filePath
            , JSON.stringify(data, null, 2));
            const notification = new electron.Notification({
                title: 'Stage saved',
                body: 'Your stage has been saved.',
                actions: [
                  { text: 'Open', type: 'button' },
                  { text: 'Show in Folder', type: 'button' }
                ],
                closeButtonText: 'Close'
              });
            
              notification.on('action', (event, index) => {
                if (index === 0) {
                  electron.shell.openPath(file.filePath);
                } else if (index === 1) {
                  electron.shell.showItemInFolder(file.filePath);
                }
              });
            
              notification.show();
    })
})

electron.ipcMain.on('playCustom', async (event, data) => {
    const filepath = await electron.dialog.showOpenDialog(win, { title: 'Select a stage file', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!filepath.canceled && filepath.filePaths.length > 0) {
        override = JSON.parse(fs.readFileSync(filepath.filePaths[0], 'utf8'));
        console.log('Override file selected:', override); // Log the selected file path
        setTimeout(() => {
            win.loadURL(`http://localhost:${port || 3000}/g?custom=${filepath.filePaths[0]}`);
        }, 1000);
        io.emit('reload');
    } else {
        console.log('No file selected or dialog was canceled'); // Log if no file was selected
    }
});

electron.ipcMain.on('findStage', async (event) => {
    win.loadFile('findstage.html');
})

electron.ipcMain.on('publishStage', async (event, data) => {
   new electron.BrowserWindow({
         webPreferences:{
              preload: __dirname + '/preload.js'
         }
    }).loadFile('publish.html');
})

electron.ipcMain.on('quit', () => {
    electron.app.quit();
})

 app.get('/s', (req, res) => {
    res.sendFile(__dirname + '/stats.html');
 })
 

 app.get('/bgmusic', (req, res) => {
    let bgM = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).bg_music;
    if(!fs.existsSync(bgM)) return res.status(404).send('Background music file not found')
    res.sendFile(bgM);
 })

 app.get('/exitcontroller', (req, res) => {
    res.sendFile(__dirname + '/exit.html');
    })

 app.get('/hitsound', (req, res) => { 
    let hitS = JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).hit_sound;
    if(!fs.existsSync(hitS)) return res.status(404).send('Hit sound file not found')
    res.sendFile(hitS);
    })

    app.get('/movement.js', (req, res) => {
        res.sendFile(__dirname + '/movement.js');
    })

    app.get('/*', (req, res) => {
        const file = fs.readFileSync(__dirname + '/controller.html', 'utf8');
        res.send(file.replace("'SPEED'", speed));
    })



        win.webContents.on('did-navigate', (e, n) => { 
            RPC_ACTION();
            if(n.includes('/g')) {
              win.setResizable(false);
            }else{
                win.setResizable(true);
            }
         });

electron.ipcMain.on('playStage', async (event, u, r) => {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${u}/${r}/main/index.json`);
        if (response.ok) {
            const data = await response.json();
            override = data;
            win.loadURL(`http://localhost:${port || 3000}/g`);
        } else {
            electron.dialog.showErrorBox('Error', 'Could not find index.json in the repository. Ask the creator to make sure there is a file named index.json in the main branch of the repository.');
        }
    } catch (e) {
        electron.dialog.showErrorBox('Error', 'An error occurred while fetching the index.json file.');
    }
});

if(process.argv.includes('--dev')) win.webContents.openDevTools();

electron.ipcMain.on('homedir', (event) => {
    event.returnValue = os.homedir();
})

electron.ipcMain.on('playStageObj', async (event, obj) => {
    override = obj;
    win.loadURL(`http://localhost:${port || 3000}/g`);
})


electron.ipcMain.on('clearCustomStage', () => {
    override = null
    electron.dialog.showMessageBox(win, { type: 'info', message: 'Custom stage cleared.' });
})

electron.ipcMain.on('toggleRPC', (event) => {
    if(JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')).disableRPC){
        fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ ...JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')), disableRPC:false }, null, 2));
        RPC_ACTION();
        }else{
        client.clearActivity().then(_ => console.log('cleared activity')).catch(console.error);
        fs.writeFileSync(`${appPath}/config.json`, JSON.stringify({ ...JSON.parse(fs.readFileSync(`${appPath}/config.json`, 'utf8')), disableRPC:true }, null, 2));
    }
})

electron.ipcMain.on('devTools', () => {
    win.webContents.isDevToolsOpened() ? win.webContents.closeDevTools() : win.webContents.openDevTools();
})
    

electron.ipcMain.on('openURL', (event, url) => {
    electron.shell.openExternal(url);
})

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        usingFallbackPort = true;
        const fallbackPort = require(`${appPath}/config.json`).fallbackPort || 3001;
        if(!process.argv.includes('--dev')) electron.dialog.showErrorBox('Error', 'Port in use. Starting on fallback port :' + fallbackPort);
        console.log('Port in use. Starting on fallback port');
        server.listen(fallbackPort, () => {
            console.log(`Server started on fallback port ${fallbackPort}`);
        });
    } else {
        console.error(err);
    }
});
})