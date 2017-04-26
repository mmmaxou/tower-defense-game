var ctx = document.getElementById("ctx").getContext("2d");
ctx.font = '30px Arial';


WIDTH = HEIGHT = 500;

var validKeys = ['z', 'q', 's', 'd']

// init
var Player = function (initPack) {
    var self = {}
    self.id = initPack.id
    self.number = initPack.number
    self.x = initPack.x
    self.y = initPack.y
    self.hp = initPack.hp
    self.hpMax = initPack.hpMax
    self.score = initPack.score
    self.upgradePoint = initPack.upgradePoint

    self.module = ['demon']

    self.draw = function () {
        // player itself
        ctx.fillStyle = 'black'
        ctx.fillRect(self.x - 1, self.y - 1, 3, 3)
    }

    self.updateFromPack = function (pack) {
        if (pack.x !== undefined)
            self.x = pack.x
        if (pack.y !== undefined)
            self.y = pack.y
        if (pack.hp !== undefined)
            self.hp = pack.hp
        if (pack.score !== undefined) {
            self.score = pack.score
            self.display.score()
        }
        if (pack.upgradePoint !== undefined) {
            self.upgradePoint = pack.upgradePoint
            self.display.upgradePoint()

        }
    }

    self.display = {
        score: function () {
            $('#score').text(self.score)
        },
        upgradePoint: function () {
            $('#upgrade-point').text(self.upgradePoint)
        }
    }

    self.updateMod = function () {

        self.module.forEach(function (e) {

            if (e == 'demon') {
                self = Demon(self)
            }
        })

        console.log(self)
    }
    self.updateMod()
    Player.list[self.id] = self
    return self
}
Player.list = {}

var Demon = function (playerSelf) {

    var self = playerSelf

    self.invulnerable = false
    self.demonState = false

    self.draw = function () {

        ctx.fillStyle = 'black'

        if (self.demonState) {
            ctx.fillRect(self.x - 3, self.y - 3, 9, 9)
        } else {
            ctx.fillRect(self.x - 1, self.y - 1, 3, 3)
        }

    }
    var super_updateFromPack = self.updateFromPack;
    self.updateFromPack = function (pack) {
        if (pack.invulnerable !== undefined)
            self.invulnerable = pack.invulnerable
        if (pack.demonState !== undefined)
            self.demonState = pack.demonState
        super_updateFromPack(pack)
    }

    //helper update
    validKeys.push(' ')


    return self

}

var Hall = function (initPack) {
    var self = {}
    self.id = initPack.id
    self.x = initPack.x
    self.y = initPack.y
    self.hp = initPack.hp
    self.hpMax = initPack.hpMax
    self.size = 10

    self.module = ['']

    self.draw = function () {
        // Hall
        ctx.fillStyle = 'black'
        ctx.fillRect(
            self.x - 1 * self.size,
            self.y - 1 * self.size,
            3 * self.size,
            3 * self.size
        )
    }

    self.updateFromPack = function (pack) {

        if (pack.x !== undefined)
            self.x = pack.x
        if (pack.y !== undefined)
            self.y = pack.y
        if (pack.hp !== undefined)
            self.hp = pack.h

    }
    self.updateMod = (function () {

        self.module.forEach(function (e) {

            if (e == 'demon') {

                //Do something 

            }
        })
    })()
    Hall.list[self.id] = self
    return self
}
Hall.list = {}


var selfId = null;
socket.on('init', function (data) {
    if (data.selfId)
        selfId = data.selfId
    for (var i = 0; i < data.player.length; i++) {
        new Player(data.player[i])
        new Hall(data.hall[i])
    }
})

// update
socket.on('update', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        var pack = data.player[i]
        var p = Player.list[pack.id]
        if (p && pack) {
            p.updateFromPack(pack)
        }
    }
    for (var i = 0; i < data.hall.length; i++) {
        var pack = data.hall[i]
        var h = Hall.list[pack.id]
        if (h && pack) {
            h.updateFromPack(pack)
        }
    }
})

//remove
socket.on('remove', function (data) {
    for (var i = 0; i < data.player.length; i++) {
        delete Player.list[data.player[i]]
    }
    for (var i = 0; i < data.hall.length; i++) {
        delete Hall.list[data.hall[i]]
    }
})

var drawMap = function () {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 500, 500)
}
var drawScore = function () {
    if (!selfId) return
    ctx.fillStyle = 'white'
    ctx.fillText(Player.list[selfId].score, 0, 30)
}

setInterval(function () {
    if (!selfId)
        return

    ctx.clearRect(0, 0, 500, 500)
    drawMap();
    drawScore();
    for (var i in Player.list)
        Player.list[i].draw()
    for (var i in Hall.list)
        Hall.list[i].draw()
}, 1000 / 25)

$(document)
    .on('keydown', function (e) {
        if (!isValidKey(e.key))
            return

        socket.emit('keyPress', {
            key: e.key,
            state: true
        })
    })
    .on('keyup', function (e) {
        if (!isValidKey(e.key))
            return
        socket.emit('keyPress', {
            key: e.key,
            state: false
        })
    })

function isValidKey(e) {
    return validKeys.some(elt => elt == e)
}
