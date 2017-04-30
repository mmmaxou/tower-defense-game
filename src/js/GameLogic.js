var ctx = document.getElementById("ctx").getContext("2d");
ctx.font = '30px Arial';

WIDTH = HEIGHT = 500;

var validKeys = ['z', 'q', 's', 'd']

// init
var user = null
var Core = function () {
    var self = {}

    self.module = {}

    self.updateMod = function () {
        for (var m in self.module) {
            var module = self.module[m]
            if (Modules[module.name]) {
                if (!module.deployed) {
                    self = Modules[module.name](self, module.options)
                    module.deployed = true
                }
            }
        }
    }
    self.resetMod = function () {
        for (var i in self.module) {
            var module = self.module[i]
            module.deployed = false
        }
    }
    return self
}
var User = function (initPack) {
    var self = {}
    self.id = initPack.id
    self.score = initPack.score
    self.upgradePoint = initPack.upgradePoint
    self.upgrades = initPack.upgrades

    self.requireUpgrades = function () {
        socket.emit('requireUpgrades')
        socket.on('upgrades', function (data) {
            self.upgrades = data
            self.drawUpgrades()
            return
        })
    }
    self.buyUpgrade = function (upgrade) {
        socket.emit('buyUpgrade', upgrade)
        socket.on('buyResult', function (data) {
            if (data.success === true) {
                toastr["success"]("Upgrade bought")
            } else if (data.success == "unaffordable") {
                toastr['error']("Can't afford the upgrade")
            } else if (data.success == "unavailable") {
                toastr['error']("Upgrade is unavailable")
            }
        })
    }

    self.draw = function () {
        $('#upgrade-point').text(self.upgradePoint)
        $('#score').text(self.score)
    }
    self.draw()
    self.drawUpgrades = function () {
        $('#available, #bought').empty()

        for (var i in self.upgrades) {
            var upgrade = self.upgrades[i]
            var html = "<button class='upgrade btn' onclick='clickUpgrade(this)'>"
            html += upgrade.name
            html += "<div class='tooltip'>"
            html += "<p>Cost : " + upgrade.cost + "</p>"
            if (upgrade.requirements != null) {
                html += "<p>Requirements"
                upgrade.requirements.forEach(function (r) {
                    html += r
                })
                html += "</p>"
            }
            html += "</div>"
            html += "</button>"

            if (upgrade.available == true) {
                $('#available').append(html)
            }
            if (upgrade.bought == true) {
                $('#bought').append(html)
            }
        }

    }
    self.drawUpgrades()
    self.updateFromPack = function (pack) {
        if (pack.score !== undefined)
            self.score = pack.score
        if (pack.upgradePoint !== undefined)
            self.upgradePoint = pack.upgradePoint
        if (pack.upgrades !== undefined) {
            self.upgrades = pack.upgrades
        }

        self.draw()
        self.drawUpgrades()
    }

    console.log(self)
    user = self
    return self
}

var Hall = function (initPack) {
    var self = Core()
    self.id = initPack.id
    self.x = initPack.x
    self.y = initPack.y
    self.size = 10

    self.module = initPack.module

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

    }

    self.resetMod()
    self.updateMod()
    Hall.list[self.id] = self
    return self
}
Hall.list = {}

var Minion = function (initPack) {
    var self = Core()

    self.id = initPack.id
    self.x = initPack.x
    self.y = initPack.y
    self.size = 1

    self.module = initPack.module

    self.draw = function () {
        // Minion
        ctx.fillStyle = 'blue'
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

    }

    self.resetMod()
    self.updateMod()

    Minion.list[self.id] = self
    return self
}
Minion.list = {}

var Modules = {
    Mod_lifeManagement: function (parent, pack) {

        var self = parent

        //        console.log(pack)
        self.hpMax = pack.hpMax
        self.hp = pack.hp || self.hpMax
        self.drawText = false

        var super_draw = self.draw
        self.draw = function () {
            self.drawLife()
            super_draw()
        }
        self.drawLife = function () {

            ctx.fillStyle = 'green'

            if (self.drawText) {

                var text = "" + self.hp + "/" + self.hpMax
                ctx.fillText(
                    text,
                    self.x,
                    self.y + 5 + self.size)
            } else {

                for (var i = 1; i <= self.hpMax; i++) {
                    if (i <= self.hp) {
                        ctx.fillStyle = 'green'
                    } else {
                        ctx.fillStyle = 'grey'
                    }
                    var GUTTER = 5

                    var barWidth = self.size * 3 // Taille propre
                    barWidth = barWidth * 2 // Augmente la taille pour depasser de l'affichage
                    barWidth = barWidth + GUTTER * self.hpMax
                    //augmente la taille pour la gouttiere


                    var x = barWidth
                    x = x / self.hpMax
                    var y = 5;

                    var deltaX = ((x + GUTTER) * (i - 1))
                    deltaX -= barWidth / 2
                    deltaX -= self.size
                    var deltaY = -(self.size * 2) - 10;

                    // Affichage
                    ctx.fillRect(
                        self.x + deltaX,
                        self.y + deltaY,
                        x,
                        y
                    )
                    //console.log(barWidth, deltaX, deltaY, x, y)

                }

            }

        }
        var super_updateFromPack = self.updateFromPack
        self.updateFromPack = function (updatePack) {

            if (updatePack.hp !== undefined)
                self.hp = updatePack.hp

            super_updateFromPack(updatePack)
        }

    }
}

var selfId = null;
socket.on('init', function (data) {
    if (data.selfId)
        selfId = data.selfId
    if (data.hall)
        for (var i = 0; i < data.hall.length; i++) {
            new Hall(data.hall[i])
        }
    if (data.minion)
        for (var i = 0; i < data.minion.length; i++) {
            new Minion(data.minion[i])
        }

})
socket.on('initUser', function (data) {
    new User(data.user)
})
// update
socket.on('update', function (data) {

    if (data.hall)
        for (var i = 0; i < data.hall.length; i++) {
            var pack = data.hall[i]
            var h = Hall.list[pack.id]
            if (h && pack) {
                h.updateFromPack(pack)
            }
        }
    if (data.minion)
        for (var i = 0; i < data.minion.length; i++) {
            var pack = data.minion[i]
            var m = Minion.list[pack.id]
            if (m && pack) {
                m.updateFromPack(pack)
            }
        }
    if (data.user)
        user.updateFromPack(data.user)

})

socket.on('hallModule', function (data) {
    var hall = Hall.list[data.id]
    hall.module[data.module.name] = {
        deployed: false,
        options: data.module.option,
        name: data.module.name,
    }
    hall.updateMod()
})
socket.on('minionModule', function (data) {
    var minion = Minion.list[data.id]
    minion.module[data.module.name] = {
        deployed: false,
        options: data.module.option,
        name: data.module.name,
    }
    minion.updateMod()
})


//remove
socket.on('remove', function (data) {
    for (var i = 0; i < data.hall.length; i++) {
        delete Hall.list[data.hall[i]]
    }
    for (var i = 0; i < data.minion.length; i++) {
        delete Minion.list[data.minion[i]]
    }
})

var drawMap = function () {
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 500, 500)
}

// LOOP
setInterval(function () {
    if (!selfId)
        return

    //    ctx.clearRect(0, 0, 500, 500)
    drawMap();
    for (var i in Hall.list)
        Hall.list[i].draw()
    for (var i in Minion.list)
        Minion.list[i].draw()

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

function clickUpgrade(e) {
    var text = e.childNodes[0].textContent
    user.buyUpgrade(text)
}

function isValidKey(e) {
    return validKeys.some(elt => elt == e)
}
