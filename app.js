var HEROKU = true;
var DIRECT_CONNECT = true;
var mongojs, db;
if (!HEROKU) {
    // Off Line
    mongojs = require('mongojs')
    db = mongojs('localhost:27017/theGame', ['account', 'progress'])
} else {
    db = null;
}

var express = require('express')
var app = express()
var serv = require('http').Server(app)

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/build/html/index.html')
})
app.use('/build', express.static(__dirname + '/build'))

serv.listen(process.env.PORT || 2000)
console.log("Server started")


var SOCKET_LIST = {}
var DEBUG = true;
var Entity = function () {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: ""
    }
    self.update = function () {
        self.updatePosition()
    }
    self.updatePosition = function () {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    self.getDistance = function (pt) {
        return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2))
    }
    return self
}

var Player = function (id) {
    var self = Entity();

    self.id = id
    self.number = "" + Math.floor(10 * Math.random())
    self.pressingRight = false
    self.pressingLeft = false
    self.pressingUp = false
    self.pressingDown = false
    self.pressingSpace = false
    self.maxSpd = 10
    self.hp = 10
    self.hpMax = 10
    self.score = 0
    self.upgradePoint = 0

    self.module = ['demon']

    var super_update = self.update;
    self.update = function () {
        self.updateSpd();
        super_update()
    }
    self.updateSpd = function () {
        if (self.pressingRight)
            self.spdX = self.maxSpd
        else if (self.pressingLeft)
            self.spdX = -self.maxSpd
        else
            self.spdX = 0

        if (self.pressingUp)
            self.spdY = -self.maxSpd
        else if (self.pressingDown)
            self.spdY = self.maxSpd
        else
            self.spdY = 0

    }
    self.getInitPack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            number: self.number,
            hp: self.hp,
            hpMax: self.hpMax,
            score: self.score,
            upgradePoint: self.upgradePoint,
        }
    }
    self.getUpdatePack = function () {
        var pack = {
            id: self.id,
            x: self.x,
            y: self.y,
            hp: self.hp,
            score: self.score,
            upgradePoint: self.upgradePoint,
        }
        return pack
    }

    self.updateMod = function () {

        self.module.forEach(function (e) {

            if (e == 'demon') {
                self = Demon(self)
            }
        })
    }
    self.updateMod()

    Player.list[id] = self
    initPack.player.push(self.getInitPack())
    return self
}
Player.list = {}
Player.onConnect = function (socket) {
    var player = Player(socket.id)

    socket.on('keyPress', function (data) {
        if (data.key === 'q')
            player.pressingLeft = data.state
        if (data.key === 'd')
            player.pressingRight = data.state
        if (data.key === 'z')
            player.pressingUp = data.state
        if (data.key === 's')
            player.pressingDown = data.state
        if (data.key === ' ')
            player.pressingSpace = data.state
    })

    var data = {
        selfId: socket.id,
        player: Player.getAllInitPack()
    }
    socket.emit('init', data)
}
Player.getAllInitPack = function () {
    var players = []
    for (var i in Player.list)
        players.push(Player.list[i].getInitPack())
    return players;
}
Player.onDisconnect = function (socket) {
    removePack.player.push(socket.id)
    delete Player.list[socket.id]
}
Player.update = function () {
    var pack = []

    for (var i in Player.list) {
        var player = Player.list[i]
        player.update()
        pack.push(player.getUpdatePack())
    }
    return pack
}

var Demon = function (playerSelf) {

    var self = playerSelf

    self.invulnerable = false
    self.demonState = false

    var super_update = self.update
    self.update = function () {
        self.updateDemon()
        super_update()
    }

    var super_getUpdatePack = self.getUpdatePack
    self.getUpdatePack = function () {
        var pack = super_getUpdatePack()
        pack.invulnerable = self.invulnerable
        pack.demonState = self.demonState

        return pack;
    }
    self.updateDemon = function () {
        if (self.pressingSpace) {
            self.maxSpd = 6
            self.invulnerable = true
            self.demonState = true
        } else {
            self.maxSpd = 10
            self.invulnerable = false
            self.demonState = false
        }

        for (var i in Player.list) {
            var player = Player.list[i]
            if (player.id !== self.id && self.demonState) {
                if (self.getDistance(player) < 10 && player.invulnerable == false) {
                    //handle kill

                    self.score++;
                    self.upgradePoint++;
                    player.killed = true

                }
            }
        }
    }

    return self

}

var Building = function () {
    var self = {
        x: 250,
        y: 250,
        id: "",
        cooldown: 25,
        tick: 25,
    }
    self.update = function () {
        self.updateTick()
    }
    self.updateTick = function () {
        self.tick--;
        //        console.log(self.tick)
        if (self.tick <= 0) {
            self.tick = self.cooldown;
            self.action()
        }
    }
    self.action = function () {
        console.log("action")
    }
    self.getDistance = function (pt) {
        return Math.sqrt(Math.pow(self.x - pt.x, 2) + Math.pow(self.y - pt.y, 2))
    }
    return self
}
var Hall = function (id) {
    var self = Building()
    self.id = id
    self.hp = 10
    self.hpMax = 10
    self.killed = false

    self.module = ['']

    self.getInitPack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            hp: self.hp,
            hpMax: self.hpMax
        }
    }
    self.getUpdatePack = function () {
        var pack = {
            id: self.id,
            x: self.x,
            y: self.y,
            hp: self.hp,
        }
        return pack
    }
    self.action = function () {
        self.spawn()
    }
    self.spawn = function () {

    }

    self.updateMod = (function () {

        console.log("Mod updated")

        self.module.forEach(function (e) {

            if (e == 'something') {
                // Do something
            }
        })
    })()

    Hall.list[id] = self
    initPack.hall.push(self.getInitPack())
    return self
}
Hall.list = {}
Hall.onConnect = function (socket) {
    var hall = Hall(socket.id)
    var data = {
        selfId: socket.id,
        hall: Hall.getAllInitPack()
    }
    socket.emit('init', data)
}
Hall.getAllInitPack = function () {
    var halls = []
    for (var i in Hall.list)
        halls.push(Hall.list[i].getInitPack())
    return halls;
}
Hall.onDisconnect = function (socket) {
    removePack.hall.push(socket.id)
    delete Hall.list[socket.id]
}
Hall.update = function () {
    var pack = []

    for (var i in Hall.list) {
        var hall = Hall.list[i]
        hall.update()
        pack.push(hall.getUpdatePack())
    }
    return pack
}





var isValidPassword = function (data, callback) {
    if (HEROKU)
        return callback(true)

    db.account.find({
        username: data.username,
        password: data.password
    }, function (err, res) {
        if (res.length > 0)
            callback(true)
        else
            callback(false)
    })
}
var isUsernameTaken = function (data, callback) {
    if (HEROKU)
        return callback(false)

    db.account.find({
        username: data.username
    }, function (err, res) {
        if (res.length > 0)
            callback(true)
        else
            callback(false)
    })
}
var addUser = function (data, callback) {
    if (HEROKU)
        return callback()
    db.account.insert({
        username: data.username,
        password: data.password
    })
    callback()
}

var io = require('socket.io')(serv, {})
io.sockets.on('connection', function (socket) {
    socket.id = Math.random();
    SOCKET_LIST[socket.id] = socket;

    socket.on('signIn', function (data) {
        isValidPassword(data, function (res) {
            if (res) {
                if (!DIRECT_CONNECT) {
                    Player.onConnect(socket);
                    Hall.onConnect(socket);
                }
                socket.emit('signInResponse', {
                    success: true
                })
            } else {
                socket.emit('signInResponse', {
                    success: false
                })
            }
        })
    })

    socket.on('startGame', function () {
        if (DIRECT_CONNECT) {
            Player.onConnect(socket);
            Hall.onConnect(socket);
        }
    })

    socket.on('signUp', function (data) {
        isUsernameTaken(data, function (res) {
            if (res) {
                socket.emit('signUpResponse', {
                    success: false
                })
            } else {
                addUser(data, function () {
                    socket.emit('signUpResponse', {
                        success: true
                    })
                })
            }
        })
    })

    socket.on('disconnect', function () {
        // Handle disconnect
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
        Hall.onDisconnect(socket);
    })

    socket.on('sendMsgToServer', function (data) {
        var playerName = ("" + socket.id).slice(2, 7);

        for (var i in SOCKET_LIST) {
            SOCKET_LIST[i].emit('addToChat', playerName + ': ' + data)
        }
    })
    socket.on('evalServer', function (data) {
        if (!DEBUG)
            return
        var res = eval(data)
        socket.emit('evalAnswer', res)

    })

})
var initPack = {
    player: [],
    hall: [],
}
var removePack = {
    player: [],
    hall: [],
}
setInterval(function () {

    var pack = {
        player: Player.update(),
        hall: Hall.update(),
    }

    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i]
        if (
            initPack.player !== [] || initPack.hall != []
        ) {
            socket.emit('init', initPack)
        }
        socket.emit('update', pack)

        if (
            removePack.player !== [] ||
            removePack.hall !== []
        )
            socket.emit('remove', removePack)
    }
    initPack.player = []
    removePack.player = []
    initPack.hall = []
    removePack.hall = []

}, 1000 / 25)
