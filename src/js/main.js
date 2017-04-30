socket = io.connect({
    'reconnection': false,
    'reconnectionDelay': 500,
    'reconnectionAttempts': 10
})
toastr = require('toastr')
toastr.options = {
    "closeButton": true,
    "debug": false,
    "newestOnTop": true,
    "progressBar": true,
    "positionClass": "toast-top-center",
    "preventDuplicates": true,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "5000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
}
var trianglify = require('trianglify')

var connected = true

$(document).ready(function () {
    $('#bottom-wrapper .wrapper-title').click(function () {
        clickOnBottomWrapper()
    })
    $('#left-wrapper .wrapper-title').click(function () {
        clickOnLeftWrapper()
    })
    var pattern = trianglify({
        width: window.innerWidth,
        height: window.innerHeight,
    })
    $('#full-body').append(pattern.svg({
        includeNamespace: true
    }))
    $('.main .sub').click(function () {
        if (connected) {
            startGame()
        } else {
            toastr["error"]("Il faut d'abord te connecter")
        }
    })
})
var isAccepted = function (value) {
    return value !== ""
}


// Sign in and Sign up
$('#sign-in').click(function () {
    if (!isAccepted($('#username').val())) {
        toastr["error"]("Le nom d'utilisateur ne doit pas être vide")
        return
    }
    if (!isAccepted($('#password').val())) {
        toastr["error"]("Le mot de passe ne doit pas être vide")
        return
    }

    socket.emit('signIn', {
        username: $('#username').val(),
        password: $('#password').val()
    })
})
$('#sign-up').click(function () {
    socket.emit('signUp', {
        username: $('#username').val(),
        password: $('#password').val()
    })
})

socket.on('signInResponse', function (data) {
    console.log(data)
    if (data.success) {
        $('#connect').hide()
        $('#chat').fadeIn()
        connected = true;
        toastr["success"]("Connexion réussie <br>Tu pouvez  commencer à jouer !")

    } else
        toastr["error"]("Erreur : Connexion échouée")
})
socket.on('signUpResponse', function (data) {
    if (data.success) {
        toastr["success"]("Inscription réussie")
    } else
        toastr["error"]("Erreur : Inscription échouée")
})

// Chat
$('#chat form').on('submit', function (e) {
    e.preventDefault();
    var text = $('#chat input[type="text"]').val()
    if (text.slice(0, 1) == "/") {
        socket.emit('evalServer', text.slice(1))
    } else {
        socket.emit('sendMsgToServer', text)
    }
})
socket.on('addToChat', function (data) {
    $('#chat-text').append('<p>' + data + '</p>')
})
socket.on('evalAnswer', function (data) {
    console.log(data)
})

socket.on('connect', function () {
    console.log("Connected")
})
socket.on('disconnect', function () {
    console.log("Disconnected")
})


function startGame() {
    //do something
    toastr["success"]("Game On !")

    $('.connection').fadeOut()
    $('.game').fadeIn()

    $('.btn-close').each(function () {
        if ($(this).hasClass('.closed')) {
            return
        }
        $(this).click()
    })

    socket.emit('startGame')
}
var clickOnBottomWrapper = function () {
    var close = $('#bottom-wrapper .btn-close');
    if (!close.hasClass('closed')) {
        $('#bottom-wrapper').css('visibility', 'hidden')
        close.toggleClass('closed')
            .css('visibility', 'visible')
    } else {
        $('#bottom-wrapper').css('visibility', 'visible')
        close.toggleClass('closed')
    }

    $('#bottom-wrapper .line').each(function () {
        $(this).slideToggle()
    })
}
var clickOnLeftWrapper = function () {
    var close = $('#left-wrapper .btn-close');
    if (!close.hasClass('closed')) {
        $('#left-wrapper').css('visibility', 'hidden')
        close.toggleClass('closed')
            .css('visibility', 'visible')
        $('#left-wrapper .wrapper-title span').text("")
    } else {
        $('#left-wrapper').css('visibility', 'visible')
        close.toggleClass('closed')
        $('#left-wrapper .wrapper-title span').text("Upgrades")
    }

    $('#left-wrapper .wrapper-title').toggleClass("changed")

    $('#left-wrapper .line').each(function () {
        $(this).slideToggle()
    })
}
