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
var assert = require('assert')
var serv = require('http').Server(app)

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/build/html/index.html')
})
app.use('/build', express.static(__dirname + '/build'))

serv.listen(process.env.PORT || 2000)
console.log("Server started")

var position = [
    {
        x: 100,
        y: 400,
        used: false,
    }, {
        x: 400,
        y: 400,
        used: false,
    }, {
        x: 100,
        y: 100,
        used: false,
    }, {
        x: 400,
        y: 100,
        used: false,
    }
]

var SOCKET_LIST = {}
var DEBUG = true;
var User = function (socket) {
    var self = {}
    self.socket = socket
    self.id = socket.id
    self.hall = Hall(self.id)
    self.score = 10
    self.upgradePoint = 10
    self.tree = Tree()

    self.deployUpgrade = function (upgrade) {
        //console.log("upgrade")
        //console.log(upgrade)
        for (var i in upgrade.options) {
            var option = upgrade.options[i]
            //console.log("option")
            //console.log(option)
            if (i == "user") {
                self.module.push({
                    name: upgrade.module,
                    options: option
                })
                self.updateMod()
            }
            if (i == "hall") {
                self.hall.module.push({
                    name: upgrade.module,
                    options: option
                })
                self.hall.updateMod()
                self.hall.sendModule({
                    name: upgrade.module
                })
            }
            if (i == "minion") {
                self.hall.minions.forEach(function (minion) {
                    minion.module.push({
                        name: upgrade.module,
                        options: option
                    })
                    minion.updateMod()
                    minion.sendModule({
                        name: upgrade.module
                    })
                })
                self.hall.minionsModules.push({
                    name: upgrade.module,
                    options: option
                })
            }
        }
        //console.log(self.hall)
    }
    self.buyUpgrade = function (upgradeName) {
        var list = self.tree.getAvailableUpgrades()
        if (list[upgradeName] === undefined) {
            socket.emit('buyResult', {
                success: "unavailable"
            })
            return
        }
        if (self.canAfford(list[upgradeName])) {
            self.tree.addUpgrade(upgradeName)
            var upgrade = self.tree.upgrades[upgradeName]
            self.deployUpgrade(upgrade)
            self.changeUpgradePoint(upgrade.cost * -1)
            socket.emit('buyResult', {
                success: true
            })
        } else {
            console.log("Can't afford the upgrade")
            socket.emit('buyResult', {
                success: "unaffordable"
            })
        }
    }
    self.canAfford = function (upgrade) {
        return upgrade.cost <= self.upgradePoint ? true : false
    }
    self.getUpgrades = function () {
        return self.tree.upgrades
    }

    self.changeScore = function (modif) {
        if (modif % 1 === 0) {
            self.score += modif
            self.sendUpdate()
        } else {
            return false
        }
    }
    self.changeUpgradePoint = function (modif) {
        if (modif % 1 === 0) {
            self.upgradePoint += modif
            self.sendUpdate()
        } else {
            return false
        }
    }
    self.disconnect = function () {
        self.hall.delete()
    }
    self.getInitPack = function () {
        return {
            id: self.id,
            score: self.score,
            upgradePoint: self.upgradePoint,
            upgrades: self.getUpgrades()
        }
    }
    self.getUpdatePack = function () {
        return {
            id: self.id,
            score: self.score,
            upgradePoint: self.upgradePoint,
            upgrades: self.getUpgrades()
        }
    }
    self.sendUpdate = function () {
        var pack = {
            user: self.getUpdatePack()
        }
        self.socket.emit('update', pack)

    }

    User.list[self.id] = self;
    return self
}
User.list = {}
User.onConnect = function (socket) {
    console.log("User " + socket.id.toFixed(2) + " connected")
    var user = User(socket)

    socket.on('requireUpgrades', function () {
        var upgrades = user.getUpgrades()
        socket.emit('upgrades', upgrades)
    })
    socket.on('buyUpgrade', function (data) {
        console.log("Buy upgrade : " + data)
        user.buyUpgrade(data)
    })

    var data = {
        selfId: socket.id,
        user: user.getInitPack(),
        hall: Hall.getAllInitPack(),
        minion: Minion.getAllInitPack(),
    }
    socket.emit('init', data)
    socket.emit('initUser', {
        user: user.getInitPack()
    })
}
User.onDisconnect = function (socket) {
    console.log("User " + socket.id.toFixed(2) + " disconnected")

    var user = User.list[socket.id]
    if (user) {
        user.disconnect()
    }
}
User.update = function () {
    for (var i in User.list) {
        var user = User.list[i]
        user.sendUpdate()
    }
}

var Tree = function () {
    var self = {}

    self.upgrades = {}
    self.upgrades.lifeManagement = Upgrade({
        cost: 1,
        module: "Mod_lifeManagement",
        options: {
            hall: {
                hpMax: 5
            },
            minion: {
                hpMax: 3
            }
        }
    })

    self.addUpgrade = function (upgradeName) {
        self.upgrades[upgradeName].bought = true
        self.upgrades[upgradeName].available = false
    }
    self.getAvailableUpgrades = function () {
        var pack = {};
        for (var i in self.upgrades) {
            var upgrade = self.upgrades[i]
            if (upgrade.available) {
                var name = upgrade.name
                pack[name] = upgrade
            }
        }
        return pack
    }

    return self;
}

var Upgrade = function (options) {
    var self = {
        cost: options.cost || 1,
        module: options.module,
        name: options.module.substring(4),
        available: true,
        bought: false,
        requirements: null,
        options: options.options || []
    }
    if (options.requirements !== undefined) {
        self.requirements = options.requirements
        self.available = false
    }
    return self
}

var Entity = function () {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY: 0,
        id: "",
        module: [],
        toRemove: false,
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
    return self
}

var Building = function () {
    var self = {
        x: 250,
        y: 250,
        id: "",
        cooldown: 25,
        tick: 25,
        toRemove: false,
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
    return self
}
var Hall = function (id) {
    console.log("creating hall : " +
        id.toFixed(2))
    var self = Building()
    self.id = id
    self.killed = false
    self.position = 0
    self.entityType = "hall"

    self.module = []

    self.minions = []
    self.minionsModules = []

    // Declare modules
    self.module.push({
        name: "Mod_getAttacked",
        options: {
            canCounterAttack: false,
            counterAttackRange: 0,
        }
    }) // Mod_getAttacked


    self.getInitPack = function () {
        var pack = {
            id: self.id,
            x: self.x,
            y: self.y,
            module: self.module,
        }
        return pack
    }
    self.getUpdatePack = function () {
        var pack = {
            id: self.id,
            x: self.x,
            y: self.y,
        }
        return pack
    }
    self.action = function () {
        if (self.minions.length >= 10) return
        self.spawn()
    }
    self.spawn = function () {
        var minion = Minion(self)
        self.minions.push(minion)
    };

    // FIND POSITION
    (function () {
        for (var p in position) {
            if (position[p].used == false) {
                position[p].used = true
                self.position = p
                self.x = position[p].x
                self.y = position[p].y
                return
            }
        }
    })()

    self.updateMod()
    self.delete = function () {
        self.toRemove = true;

        var pos = self.position;
        position[pos].used = false

        self.deleteMinions(function () {

            removePack.hall.push(self.id)
            Hall.list[self.id] = undefined
            delete Hall.list[self.id]
            delete self
            //console.log("hall deleted")

        })
    }
    self.deleteMinions = function (callback) {
        if (self.minions.length >= 1) {
            self.minions[0].delete()
            self.deleteMinions(callback)
        } else {
            //console.log("All minions deleted")
            //console.log(self.minions)
            callback()
        }
    }
    self.sendModule = function (module) {
        module.option = self.getUpdatePack()
        for (var i in SOCKET_LIST) {
            var socket = SOCKET_LIST[i]
            var data = {
                id: self.id,
                module: module
            }
            socket.emit('hallModule', data)
        }
    }

    Hall.list[id] = self
    initPack.hall.push(self.getInitPack())
    return self
}
Hall.list = {}
Hall.getAllInitPack = function () {
    var halls = []
    for (var i in Hall.list)
        halls.push(Hall.list[i].getInitPack())
    return halls;
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

var Minion = function (parent) {
    var self = Entity()
    self.id = rand(0, 100)
    self.x = parent.x
    self.y = parent.y
    self.parentId = parent.id
    self.spdX = 0
    self.spdY = 0
    self.speed = 2
    self.size = 1
    self.entityType = "minion"
    self.parent = function () {
        return Hall.list[self.parentId]
    }

    //randomize spawn position
    ;
    /*
    (function () {
        var x = wheel(2) ? 20 : -20
        var y = wheel(2) ? 20 : -20
        x += Math.ceil(rand(0, 10))
        y += Math.ceil(rand(0, 10))
        self.x += x
        self.y += y
    })()
    */
    /// Declare modules
    self.module.push({
        name: "Mod_getAttacked",
        options: {
            counterAttackRange: 4
        }
    }) // Mod_getAttacked
    self.module.push({
        name: "Mod_attack",
        options: {
            attackRange: 3
        }
    }) // Mod_attack
    self.module.push({
        name: "Mod_cooldown",
        options: {
            cooldown: 50
        }
    }) // Mod_attack

    if (parent.minionsModules.length >= 1) {
        parent.minionsModules.forEach(function (module) {
            var newModule = JSON.parse(JSON.stringify(module))
            newModule.deployed = false
            self.module.push(newModule)
        })
    }
    self.super_update = self.update
    self.update = function () {
        self.checkRemove()
        self.super_update()
    }

    self.checkRemove = function () {
        if (self.toRemove) {
            self.delete()
        }
        if (self.parent() == undefined) {
            self.delete()
        }
    }

    self.getInitPack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
            module: self.module,
        }
    }
    self.getUpdatePack = function () {
        return {
            id: self.id,
            x: self.x,
            y: self.y,
        }
    }

    self.delete = function () {

        self.toRemove = true;
        if (self.parent()) {
            var index = self.parent().minions.findIndex(minion => minion.id == self.id)
            self.parent().minions.splice(index)
            //console.log(self.parent().minions)
        }

        removePack.minion.push(self.id)
        Minion.list[self.id] = undefined
        delete Minion.list[self.id]
        delete self
    }

    self.sendModule = function (module) {
        module.option = self.getUpdatePack()
        for (var i in SOCKET_LIST) {
            var socket = SOCKET_LIST[i]
            var data = {
                id: self.id,
                module: module
            }
            socket.emit('minionModule', data)
        }
    }
    self.updateMod()

    Minion.list[self.id] = self
    initPack.minion.push(self.getInitPack())
    return self
}
Minion.list = {}
Minion.getAllInitPack = function () {
    var minions = []
    for (var i in Minion.list) minions.push(Minion.list[i].getInitPack())
    return minions;
}
Minion.update = function () {
    var pack = []

    for (var i in Minion.list) {
        var minion = Minion.list[i]
        minion.update()
        pack.push(minion.getUpdatePack())
    }
    return pack
}

var Modules = {
    Mod_getAttacked: function (parent, options = {}) {
        var self = parent

        self.canCounterAttack = true || options.canCounterAttack
        self.counterAttackRange = options.counterAttackRange || 4
        self.killReward = 1

        var super_update = self.update
        self.getAttacked = function (attacker) {
            if (!attacker) {
                return
            }
            // Try to counter

            if (self.canCounterAttack) {
                self.counterAttack(attacker)
            }

            // Gt damage
            self.getDamage(attacker)

        }
        self.counterAttack = function (attacker) {
            if (!attacker) {
                return
            }
            var dist = self.getDistance(attacker)
            if (dist < self.counterAttackRange + (3 * self.size)) {
                attacker.canCounterAttack = false
                attacker.getAttacked(self)
            }
        }
        self.getDamage = function (attacker) {
            if ('getKillReward' in attacker)
                attacker.getKillReward(self)
            self.delete()
        }

        return self
    },
    Mod_lifeManagement: function (parent, options = {}) {
        var self = parent

        self.hpMax = options.hpMax || 10
        self.hp = self.hpMax

        self.getDamage = function (attacker) {
            self.hp -= 1
            if (self.hp <= 0) {
                if ('getKillReward' in attacker)
                    attacker.getKillReward(self)
                self.delete()
            }
        }
        self.lifeManagement_getUpdatePack = self.getUpdatePack
        self.getUpdatePack = function () {
            var pack = self.lifeManagement_getUpdatePack()
            pack.hp = self.hp
            pack.hpMax = self.hpMax
            return pack
        }
        self.lifeManagement_getInitPack = self.getInitPack
        self.getInitPack = function () {
            var pack = self.lifeManagement_getInitPack()
            pack.hp = self.hp
            pack.hpMax = self.hpMax
            return pack
        }
        return self;
    },
    Mod_attack: function (parent, options = {}) {
        var self = parent

        self.findHallStrategy = options.findHallStrategy || 'closest'
        self.findMinionStrategy = options.findMinionStrategy || 'closest'
        self.ennemyHall = null
        self.target = null
        self.attackRange = options.attackRange || self.size * 3

        self.update = function () {
            self.checkRemove()

            self.findTarget()
            self.moveToTarget()

            self.super_update()
        }

        self.getEnnemyHall = function () {
            return Hall.list[self.ennemyHall]
        }
        self.attackTarget = function () {
            if (!self.target) {
                return
            }
            if (self.target.id == self.id) {
                self.target = null
                return
            }
            if (self.target.entityType == "hall") {
                //console.log("I attack a hall")
            }
            self.target.getAttacked(self)
        }
        self.getKillReward = function (ennemyKilled) {
            //console.log(ennemyKilled.killReward)
        }
        self.hasTarget = function () {
            if (!self.target) {
                return false
            } else {
                if (self.target.toRemove) {
                    self.target = null
                    return false
                }
                return true
            }
        }
        self.findEnnemyHall = function () {

            for (var h in Hall.list) {
                var hall = Hall.list[h]
                if (hall.id != self.parent().id) {
                    self.ennemyHall = hall.id
                }
            }

        }
        self.findEnnemyMinion = function () {
            if (!self.getEnnemyHall()) {
                return
            }

            var list = self.getEnnemyHall().minions

            var min = undefined;
            var found = undefined;

            for (var i in Minion.list) {
                var minion = Minion.list[i]
                if (minion.parent() != self.parent()) {
                    var d = self.getDistance(minion)
                    if (min == undefined) {
                        found = minion;
                        min = d
                    } else if (min > d) {
                        found = minion;
                        min = d
                    }
                }
            }

            if (found) {
                self.target = found
                return true
            }
            return false

        }
        self.findTarget = function () {

            if (!self.ennemyHall) {
                self.findEnnemyHall()
            }
            if (!self.getEnnemyHall()) {
                return
            }

            if (!self.findEnnemyMinion()) {
                self.target = self.getEnnemyHall()
            }

        }
        self.targetInRange = function () {
            if (!self.target) return;

            var dist = self.getDistance(self.target)
            if (dist < self.attackRange + 3 * self.size) {
                if (self.tryAction != undefined) {
                    self.tryAction(self.attackTarget)
                } else {
                    self.attackTarget()
                }
                return true
            } else {
                return false
            }
        }
        self.moveToTarget = function () {
            if (!self.target) {
                self.spdX = 0
                self.spdY = 0;
                return
            }

            // If target is in tange , don't move
            if (self.targetInRange()) {
                self.spdX = 0
                self.spdY = 0;
                return
            }

            //Angle toward target
            var deltaX = self.target.x - self.x
            var deltaY = self.target.y - self.y
            var angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)

            // Add movement
            self.spdX = Math.cos(angle / 180 * Math.PI) * self.speed
            self.spdY = Math.sin(angle / 180 * Math.PI) * self.speed

        }

        return self
    },
    Mod_cooldown: function (parent, options = {}) {
        var self = parent

        self.cooldown = options.cooldown || 25
        self.tick = self.cooldown

        self.tryAction = function (callback) {
            self.updateTick(callback)
        }
        self.updateTick = function (callback) {
            self.tick--;
            if (self.tick == 0) {
                self.tick = self.cooldown;
                callback()
            } else {
                return
            }
        }

        return self
    }
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
                    User.onConnect(socket);
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
            User.onConnect(socket);
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
        User.onDisconnect(socket);
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
        console.log(eval(data))
        socket.emit('evalAnswer', res)

    })

})
var initPack = {
    user: [],
    hall: [],
    minion: []
}
var removePack = {
    user: [],
    hall: [],
    minion: []
}

setInterval(function () {

    var pack = {
        hall: Hall.update(),
        minion: Minion.update(),
    }

    for (var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i]
        if (
            initPack.user.length != 0 ||
            initPack.hall.length != 0 ||
            initPack.minion.length != 0
        ) {
            socket.emit('init', initPack)
        }
        socket.emit('update', pack)
        if (
            removePack.user.length != 0 ||
            removePack.hall.length != 0 ||
            removePack.minion.length != 0
        ) {
            socket.emit('remove', removePack)
        }
    }


    initPack = {
        user: [],
        hall: [],
        minion: []
    }
    removePack = {
        user: [],
        hall: [],
        minion: []
    }

}, 1000 / 25)

// IA 
var ennemyHall = Hall(rand())





// HELPERS
function rand(min = 0, max = 1) {
    return (Math.random() * (max - min)) + min
}

function wheel(number) {
    var a = Math.ceil(rand(0, number))
    return a == number
}
