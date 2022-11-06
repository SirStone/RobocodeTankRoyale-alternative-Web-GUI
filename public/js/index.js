/* WEBSOCKETS STUFF */
var server_ws = false // this socket is for all messages sent by processes runned form the server
var controller_ws = false // this socket is required to control the game server as per Robocode Tank Roayle Docs

// items related to the Web sockets
var connectionCheck_interval = null
var connectionCheck_speed = 1000 // in milliseconds, frequency of the websocket status check

// variables to keep track of the last status of the websockets
// used to avoid to update the UI at every check cycle
var last_serverWS_state = 0
var last_controllerWS_state = 0

// this bot list contains the bots currently connected to the server
// the array is filled and kept in sync with the bot list provided by the game server itself 
var connected_bots = []

// objects that are required multiple times
const server_box = $('#server_box')
const booter_box = $('#booter_box')
const robot_tabs = $('#robot_tabs')
const serverContent = $('#serverContent')
const botsContent = $('#botsContent')
const runBotUIButton = $('#run_bot_button')
var gameAutoStart = false
var numberOfParticipants = 0

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
    server_ws = new WebSocket('ws://localhost:8000/api', ['soap', 'xmpp'])
    server_ws.onopen = function() {}

    server_ws.onmessage = function (message) {
        handleMessage(message.data)
    }
    server_ws.onerror = function(error) {
        console.error(`API WebSocket ERROR: ${error.code} ${error.reason}`)    
    }
    server_ws.onclose = function(msg) {
        if(msg.code !== 1001) { // server is 'going away'
            console.warn(`API WebSocket CLOSED: ${msg.code} ${msg.reason}, trying again`)
            connectToAPI()
        }
    }
}

function connectController() {
    $.get({
        url: '/getServerPort',
        dataType: 'json'
    }).done((data) => {
        controller_ws = new WebSocket(`ws://localhost:${data.port}/controller`, ['soap', 'xmpp'])
        controller_ws.onopen = function() {}

        controller_ws.onmessage = function (message) {
            var data = JSON.parse(message.data)
            switch(data.type) {
                case "ServerHandshake":
                    var myhandshake = JSON.stringify({
                        sessionId: data.sessionId,
                        type: "ControllerHandshake",
                        name: "web ui controller",
                        version: "1.0",
                        secret: "controllersecret"
                    })
                    controller_ws.send(myhandshake)
                    break;
                case "BotListUpdate":
                    connected_bots = data.bots
                    if(connected_bots.length == 0) {
                        $('.running_bot').remove()

                        // for testing
                        // addBotToLaunchpad(8)
                        // addBotToLaunchpad(0)
                    }
                    else {
                        connected_bots.forEach(bot => {
                            if(!SIDtoPID.hasOwnProperty(bot.sessionId)) {
                                const PID = findPID()
                                if(PID) {
                                    PIDtoSID[PID]= bot.sessionId
                                    SIDtoPID[bot.sessionId] = PID
                                    
                                    // send back the Session Id to the server, it needs to know it for later purposes
                                    sendSID(PID, bot.sessionId)
                                }
                            }
                        })
                        
                        const index = launchingPad.shift()
                        if(index) {
                            runBots(index)
                        }
                        else {
                            launchingInAction = false
                            runBotButton(true)
                        }

                        //leave here this commented, uncomment if debug these items is required
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
                    console.warn("NOT HANDLED MESSAGE",data)
            }
        }
        controller_ws.onerror = function(error) {
            console.error(`CONTROLLER WebSocket ERROR: ${error.code} ${error.reason}`,error)    
        }
        controller_ws.onclose = function(msg) {
            if(msg.code !== 1001) { // server is 'going away'
                console.warn(`CONTROLLER WebSocket CLOSED: ${msg.code} ${msg.reason}, trying again`)
                setTimeout(connectController, 1000)
            }
        }
    })
}

function findPID() {
    for (var key in PIDtoSID) {
        if (!PIDtoSID[key]) return key
    }
    return false
}

function sendSID(PID, SID) {
    $.post({
        url: '/addSID',
        dataType: 'json',
        data: {'PID':PID, 'SID': SID}
    }).done(() => {

    })
}

function rebootServer() {
    $.ajax({
        url: '/rebootServer',
        dataType: 'json'
    }).done(() => {

    })
}

function startGame() {
    if(controller_ws) {
        //send game setup
        var botAddresses = []
        connected_bots.forEach(bot => {
            botAddresses.push({host:bot.host, port:bot.port})
        })

        var start_game_message = JSON.stringify({
            type: 'StartGame',
            gameSetup,
            botAddresses: botAddresses
        })

        controller_ws.send(start_game_message)
    }
}

function stopGame() {
    var stop_game_message = JSON.stringify({
        type: 'StopGame'
    })

    controller_ws.send(stop_game_message)
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

        while (launchPad_busy) {
            sleep(10)
        } 

        runBots(getNext())
    })
}

function runSelectedBot() {
    // addBotToLaunchpad($('#available_bots').val())
    if(!launchingInAction) runBots($('#available_bots').val())
}

var launchingInAction = false
function addBotToLaunchpad(index) {
    launchingPad.push(index)

    if(!launchingInAction) runBots(launchingPad.shift())
}

function runBots(index) {
    launchingInAction = true
    runBotButton(false)
    $.get({
        url: '/runBot',
        dataType: 'json',
        data: {
            index: index
        }
    }).done(new_bot => {
        numberOfParticipants++
        PIDtoSID[`${new_bot.pid}`] = false
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
        resetPID_SID()
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

function checkConnections() {
    if(last_serverWS_state !== server_ws.readyState) { //changed!
        if(server_ws.readyState == WebSocket.OPEN) {
            $('#serverWS').addClass('has-text-success')
        }
        else{
            $('#serverWS').removeClass('has-text-success')
        }
        last_serverWS_state = server_ws.readyState
    }
    
    
    if(last_controllerWS_state !== controller_ws.readyState) { //changed!
        if(controller_ws.readyState == WebSocket.OPEN) {
            $('#controllerWS').addClass('has-text-success')
        }
        else{
            $('#controllerWS').removeClass('has-text-success')
        }
        last_controllerWS_state = controller_ws.readyState
    }
}

function runBotButton(status) {
    if(status) runBotUIButton.addClass('is-info')
    else runBotUIButton.removeClass('is-info')
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// the MAIN function, this start as soon as the page is 'ready'
$( document ).ready(function() {
    // start connecting to the API WebSocket
    connectToAPI()

    // start connecting to the Game Server WebSocket as Controller
    connectController()

    // start connection checks every second
    connectionCheck_interval = setInterval(checkConnections, connectionCheck_speed)

    // init the game canvas with the game setup object
    // TODO: move this in a specific function that can be called in another time
    $('.gamecanvas').attr({
        width: gameSetup.arenaWidth * ratio,
        height: gameSetup.arenaHeight * ratio
    })

    // fill the background of the canvas
    // TODO: delete this and leave another function to call this one
    drawBackground(bctx);
})