// the MAIN function, this start as soon as the page is 'ready'
$( document ).ready(function() {
    // start connecting to the API WebSocket
    connectToAPI()

    // start connecting to the Game Server WebSocket as Controller
    connectController()

    // init the game canvas with the game setup object
    // TODO: move this in a specific function that can be called in another time
    $('.gamecanvas').attr({
        width: gameSetup.arenaWidth * ratio,
        height: gameSetup.arenaHeight * ratio
    })

    // fill the background of the canvas
    // TODO: delete this and leave another function to call this one
    drawBackground(bctx);

    // creates the tooltip bubble for each running bot
    createToolTips()
})

// websocket connections
var server_connection

// objects that are required multiple times
const server_box = $('#server_box')
const booter_box = $('#booter_box')
const robot_tabs = $('#robot_tabs')
const serverContent = $('#serverContent')
const botsContent = $('#botsContent')
var gameAutoStart = false
var numberOfParticipants = 0

// game setup
// TODO: move this in an external javascript file on its own
var gameSetup = {
    gameType:'classic',
    arenaWidth:800,
    isArenaWidthLocked:true,
    arenaHeight:600,
    isArenaHeightLocked:true,
    minNumberOfParticipants:2,
    isMinNumberOfParticipantsLocked:true,
    maxNumberOfParticipants:null,
    isMaxNumberOfParticipantsLocked:true,
    numberOfRounds:1,
    isNumberOfRoundsLocked:false,
    gunCoolingRate:0.1,
    isGunCoolingRateLocked:false,
    maxInactivityTurns:450,
    isMaxInactivityTurnsLocked:false,
    turnTimeout:30_000, // default 30_000 = 30 milliseconds
    isTurnTimeoutLocked:false,
    readyTimeout:1, // 1 second
    isReadyTimeoutLocked:false,
    defaultTurnsPerSecond:1
}

// canvas required items
var ratio = 0.5 // all the linear sizes are scaled with this ratio
const bctx = $('#background')[0].getContext('2d') //background canvas object
const ctx = $('#battlefield')[0].getContext('2d') //foreground ak battlefield canvas object
const backgroundColor = '#63718e' // background color

// physics rules
const radarRadius = 1200 // radar max distance
const oneDegree = Math.PI / 180.0 // one degree in radians
const gun_radius = 36 // dimension of gun cannon. TODO: fix why I can't see the gun anymor ein the canvas

// running bots launchpad items
var launchingPad = [] // this contains the bots that needs to be runned, it's a FIFO buffer
var PIDtoSID = {} // table containing the PID and SID data, where the PID is the key
var SIDtoPID = {} // table containing the PID and SID data, where the SID is the key

// function that receives all the messages from the server WebSocket and handles them with a switch
function handleMessage(data) {
    var parsed_data = JSON.parse(data) // data received is raw, must be parsed
    var message = parsed_data.message.trim() // removing extra withe spaces from the message
    
    // GATE: stop if the message is empty
    if(message.length == 0) return

    switch(parsed_data.process) {
        case 'server': // message belongs to the game server process
            // put the message in the UI    
            serverContent.append(`${message}\n`)

            // scroll the textarea to the last content
            var textarea = document.getElementById('serverContent')
            textarea.scrollTop = textarea.scrollHeight
            break
        case 'bot': // message belongs to a bot process
            if(parsed_data.channel == 'close') { // the process closed
                // search for all UI items beloging to this bot and delete them
                if(!$(`#${parsed_data.pid}`).length) {
                    $(`.item_for_${parsed_data.pid}`).remove()
                }
            }
            else {
                if(!$(`#${parsed_data.pid}`).length) {
                    addRunningBotTab(parsed_data.pid, parsed_data.name)
                }
                
                var id = `${parsed_data.pid}_content`
                $(`#${id}`).append(`${message}\n`)
                var textarea = document.getElementById(id)
                textarea.scrollTop = textarea.scrollHeight
            }        
            break
    }
}

function connectToAPI() {
    console.log("start listening to server")
    server_connection = new WebSocket('ws://localhost:8000/connect', ['soap', 'xmpp'])
    server_connection.onopen = function() {
        console.log("API WebSocket OPEN: connection is established")
    }

    server_connection.onmessage = function (message) {
        $('#connection-off').addClass('hidden')
        $('#connection-on').removeClass('hidden')
        handleMessage(message.data)
    }
    server_connection.onerror = function(error) {
        console.error(`API WebSocket ERROR: ${error.code} ${error.reason}`)    
    }
    server_connection.onclose = function(msg) {
        $('#connection-on').addClass('hidden')
        $('#connection-off').removeClass('hidden')
        console.warn(`API WebSocket CLOSED: ${msg.code} ${msg.reason}, trying again`)
        connectToAPI()
    }
}

var controller_connection = false
var botlist = []
function connectController() {
    $.get({
        url: '/getServerPort',
        dataType: 'json'
    }).done((data) => {
        controller_connection = new WebSocket('ws://localhost:'+data.port, ['soap', 'xmpp'])
        controller_connection.onopen = function() {
            console.log("CONTROLLER WebSocket OPEN: connection is established")
            $('#controller-off').addClass('hidden')
            $('#controller-on').removeClass('hidden')
        }

        controller_connection.onmessage = function (message) {
            $('#controller-off').addClass('hidden')
            $('#controller-on').removeClass('hidden')
            var data = JSON.parse(message.data)
            switch(data.type) {
                case "ServerHandshake":
                    // console.log(data)
                    var myhandshake = JSON.stringify({
                        sessionId: data.sessionId,
                        type: "ControllerHandshake",
                        name: "web ui controller",
                        version: "1.0",
                        secret: "controllersecret"
                    })
                    controller_connection.send(myhandshake)
                    break;
                case "BotListUpdate":
                    // console.log(data)
                    botlist = data.bots
                    if(botlist.length == 0) {
                        $('.running_bot').remove()

                        // for testing
                        // addBotToLaunchpad(8)
                        // addBotToLaunchpad(0)
                    }
                    else {
                        data.bots.forEach(bot => {
                            if(!SIDtoPID.hasOwnProperty(bot.sessionId)) {
                                const PID = findPID()
                                if(PID) {
                                    PIDtoSID[PID]= bot.sessionId
                                    SIDtoPID[bot.sessionId] = PID
                                }
                            }
                        })
                        
                        const index = launchingPad.shift()
                        if(index) runBots(index)
                        else launchingInAction = false

                        // console.table(PIDtoSID)
                        // console.table(SIDtoPID)
                    }
                    break
                case "GameStartedEventForObserver":
                    $('#numberOfRound').text(0)
                    $('#maxNumberOfRounds').text(data.gameSetup.numberOfRounds)
                    $('.bot_textarea').append('---GAME STARTED-----------------\n')
                    createBotUpdates(data)
                    break
                case "RoundStartedEvent":
                    $('#numberOfRound').text(data.roundNumber)
                    break
                case "TickEventForObserver":
                    // console.log(data)
                    $('#numberOfTurn').text(data.turnNumber)
                    updateBotUpdates(data)

                    ctx.clearRect(0, 0, bctx.canvas.width, bctx.canvas.height)

                    data.botStates.forEach(botstate => {
                        var bot_centerX = botstate.x * ratio
                        var bot_centerY = botstate.y * ratio

                        ctx.lineWidth = 2 * ratio

                        // radar
                        drawRadar(ctx, botstate, ratio, bot_centerX, bot_centerY, radarRadius)

                        // gun
                        drawGun(ctx, botstate, ratio, bot_centerX, bot_centerY, gun_radius)

                        // direction
                        drawDirection(ctx, botstate, bot_centerX, bot_centerY, ratio)

                        // hitting circle
                        let hittingCircle_radius = drawHittingCircle(ctx, botstate, ratio, bot_centerX, bot_centerY)

                        // ID
                        // drawId(ctx, botstate, bot_centerX, bot_centerY, ratio, hittingCircle_radius)
                    })
                    data.bulletStates.forEach(bulletState => {
                        drawBullet(ctx, bulletState, ratio)
                    })
                    break
                case 'GameEndedEventForObserver':
                    updateScores(data)
                    saveBotResults(data)
                    startGame()
                    break
                default:
                    console.log(data)
            }
        }
        controller_connection.onerror = function(error) {
            console.error(`CONTROLLER WebSocket ERROR: ${error.code} ${error.reason}`,error)    
        }
        controller_connection.onclose = function(msg) {
            $('#controller-on').addClass('hidden')
            $('#controller-off').removeClass('hidden')
            console.warn(`CONTROLLER WebSocket CLOSED: ${msg.code} ${msg.reason}, trying again`)
            setTimeout(connectController, 1000)
        }
    })
}

function findPID() {
    for (var key in PIDtoSID) {
        if (!PIDtoSID[key]) return key
    }
    return false
}

function rebootServer() {
    $.ajax({
        url: '/rebootServer',
        dataType: 'json'
    }).done(() => {

    })
}

function startGame() {
    if(controller_connection) {
        //send game setup
        var botAddresses = []
        botlist.forEach(bot => {
            botAddresses.push({host:bot.host, port:bot.port})
        })

        var start_game_message = JSON.stringify({
            type: 'StartGame',
            gameSetup,
            botAddresses: botAddresses
        })

        controller_connection.send(start_game_message)
    }
}

function stopGame() {
    var stop_game_message = JSON.stringify({
        type: 'StopGame'
    })

    controller_connection.send(stop_game_message)
}

function resetPID_SID() {
    PIDtoSID = {}
    SIDtoPID = {}
}

function rebootBots() {
    stopGame()
    resetPID_SID()

    // kill all bots and get the indexes
    $.get({
        url: '/killAllBots',
        dataType: 'json'
    }).done((data) => {
        launchingPad = data.indexes
        runBots(launchingPad.shift())
    })
}

function runSelectedBot() {
    addBotToLaunchpad($('#available_bots').val())
}

var launchingInAction = false
function addBotToLaunchpad(index) {
    launchingPad.push(index)
    if(!launchingInAction) runBots(launchingPad.shift())
}

function runBots(index) {
    launchingInAction = true
    $.get({
        url: '/runBot',
        dataType: 'json',
        data: {
            index: index
        }
    }).done(new_bot => {
        numberOfParticipants++
        PIDtoSID[`${new_bot.pid}`] = false
        console.table(PIDtoSID)
    })
}

function killAllBots() {
    stopGame()
    $.ajax({
        url: '/killAllBots',
        dataType: 'json',
    }).done(() => {
        $('.running_bot').remove()
        $('.botUpdate').remove()
    })
}

function createBotUpdates(gameStartData) {
    gameStartData.participants.forEach(bot => {
        if(!$(`#botUpdate_${bot.id}`).length) {
            $('#botUpdates').append(`<tr id="botUpdate_${bot.id}" class="botUpdate"><td class="botUpdate_id">${bot.id}</td><td class="botUpdate_name">${bot.name}</td><td class="botUpdate_energy">?</td><td class="bd">0</td><td class="bkb">0</td><td class="lsb">0</td><td class="rd">0</td><td class="rkb">0</td><td class="surv">0</td><td class="TS">0</td></tr>`)
        }
    })
}

function updateBotUpdates(tickData) {
    tickData.botStates.forEach(botState => {
        const PID = SIDtoPID[botState.sessionId]
        $('.energy',$(`#${PID}_label`)).text(`E:${Math.round(botState.energy, 2)}`)
        $('.botUpdate_energy',`#botUpdate_${botState.id}`).text(Math.round(botState.energy, 2))
    })
}

function updateScores(gameEndedData) {
    gameEndedData.results.forEach(botResults => {
        $('.botUpdate_name',`#botUpdate_${botResults.id}`).text(botResults.name)
        var bd = $('.bd',`#botUpdate_${botResults.id}`)
        bd.text(parseInt(bd.text()) + botResults.bulletDamage)

        var bkb = $('.bkb',`#botUpdate_${botResults.id}`)
        bkb.text(parseInt(bkb.text()) + botResults.bulletKillBonus)

        var lsb = $('.lsb',`#botUpdate_${botResults.id}`)
        lsb.text(parseInt(lsb.text()) + botResults.lastSurvivorBonus)

        var rd = $('.rd',`#botUpdate_${botResults.id}`)
        rd.text(parseInt(rd.text()) + botResults.ramDamage)

        var rkb = $('.rkb',`#botUpdate_${botResults.id}`)
        rkb.text(parseInt(rkb.text()) + botResults.ramKillBonus)

        var surv = $('.surv',`#botUpdate_${botResults.id}`)
        surv.text(parseInt(surv.text()) + botResults.survival)

        var TS = $('.TS',`#botUpdate_${botResults.id}`)
        TS.text(parseInt(TS.text()) + botResults.totalScore)
    })
}

function saveBotResults(gameEndedData) {
    $.get({
        url: '/saveBotResults',
        dataType: 'json',
        data: { 
            results : gameEndedData.results
        }
    })
}

function createToolTips() {
    $( ".tab_label" ).tooltip({
        track: false,
        position: { at: "right+5 center-27.5", of: "#run_bot_button" },
        classes: {
            "ui-tooltip": "tag is-info"
          }
    });
}

function addRunningBotTab(pid, name) {
    var item_class = `item_for_${pid}`
    $('#stdout_tabs').append(`<input class="tab_input running_bot ${item_class}" id="${pid}" type="radio" name="stdout_tab">`)
    $('#stdout_tabs').append(`<label id="${pid}_label" class="tab_label running_bot ${item_class} has-text-centered" for="${pid}" title="NAME:${name} PID:${pid}">${name}<br><p class="energy">E:?</p></label>`)
    $('#stdout_tabs').append(`<div class="tab_content running_bot ${item_class}"><textarea class="textarea is-small has-fixed-size" id="${pid}_content" rows="21" name="${pid}_content" placeholder="Console output for ${name}(${pid})" readonly="readonly" autocomplete="off"></textarea></div>`)
    if($('.tab_label').length == numberOfParticipants+1) {
        createToolTips()
    }
    else {
        console.info('tootltips nto created',$('.tab_label').length, numberOfParticipants)
    }
}