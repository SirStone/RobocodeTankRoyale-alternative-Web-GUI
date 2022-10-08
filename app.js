// app.js

/**
 * Required External Modules
 */
const express = require("express")
const path = require("path")
const fs = require("fs")
const { spawn, ChildProcess, exec, spawnSync } = require("child_process")
const { kill } = require("process")
const { Console } = require("console")
require('dotenv').config()

// CSV writing
const columns = [
  "id",
  "name",
  "version",
  "rank",
  "lastSurvivorBonus",
  "bulletDamage",
  "bulletKillBonus",
  "ramDamage",
  "ramKillBonus",
  "totalScore",
  "firstPlaces",
  "secondPlaces",
  "thirdPlaces"
]

const createCsvWriter = require('csv-writer').createObjectCsvWriter

var today = new Date()
var dd = String(today.getDate()).padStart(2, '0')
var mm = String(today.getMonth() + 1).padStart(2, '0') //January is 0!
var yyyy = today.getFullYear();
today = dd + mm + yyyy
const version = process.env.VERSION

const csvWriter = createCsvWriter({
  path: `${process.env.CSVPATH}/${today}.csv`,
  header: [
    {id: 'id', title: 'id'},
    {id: 'name', title: 'name'},
    {id: 'version', title: 'version'},
    {id: 'rank', title: 'rank'},
    {id: 'lastSurvivorBonus', title: 'last survivior bonus'},
    {id: 'bulletDamage', title: 'bullet damage'},
    {id: 'bulletKillBonus', title: 'bullet kill bonus'},
    {id: 'ramDamage', title: 'ram damage'},
    {id: 'ramKillBonus', title: 'ram kill bonus'},
    {id: 'totalScore', title: 'total score'},
    {id: 'firstPlaces', title: 'first places'},
    {id: 'secondPlaces', title: 'second places'},
    {id: 'thirdPlaces', title: 'third places'}
  ]
})

/**
 * App Variables
 */
const app = express()
const port = process.env.APP_PORT
const expressWs = require('express-ws')(app)
const bot_roots = [
  { tag:`Sample Bots V${version}`, path: `${process.env.SAMPLEBOTSDIR}/sample-bots-java-${version}`}
]
const bot_dirs_exploded = process.env.BOTDIRS.split('|')
bot_dirs_exploded.forEach(bots_dir => {
  const bot_dir_exploded = bots_dir.split(',')
  bot_roots.push({tag:bot_dir_exploded[0], path:bot_dir_exploded[1]})
});
const available_bots = []
var running_bots = []
var gameAutoStart = false
var numberOfParticipants = 0

/**
 *  App Configuration
 */
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
app.use(express.static(path.join(__dirname, "public")))
app.use('/jquery-ui', express.static(path.join(__dirname, '/node_modules/jquery-ui')))
app.use('/fa', express.static(path.join(__dirname, '/node_modules/@fortawesome/fontawesome-free')))

/**
 * Web sockets and processes
 */
var connection_ws = false
var serverProcess = false

/**
 * Routes Definitions
 */
app.get("/", (req, res) => {
  res.render("index", { title: "Genetic Lab", available_bots: available_bots, running_bots: running_bots })
})

app.ws("/connect", (ws, req) => {
    connection_ws = ws
})

app.get('/getServerPort', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify({'port':server_port}))
})

app.get('/rebootBots', (req, res) => {
  var indexes = []
  // kill bots but save the indexes for the reboot
  running_bots.forEach(bot => {
    spawn('pkill',['-TERM','-P',bot.pid])
    indexes.push(bot.index)
  })
  running_bots = []
  
  // reboot the bots
  var new_bot = {}
  indexes.forEach(index => {
    new_bot = runBot(index)
  }) 

  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify({result:true, numberOfParticipants:indexes.length, new_bot: new_bot}))
})

app.get('/killAllBots', (req, res) => {
  var indexes = []
  running_bots.forEach(bot => {
    spawn('pkill',['-TERM','-P',bot.pid])
    indexes.push(bot.index)
  })
  running_bots = []

  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify({'indexes':indexes}))
})

app.get('/runBot', (req, res) => {
  var running_bot = runBot(req.query.index)
  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify(running_bot))
})

app.get('/removeBot', (req, res) => {
  removeBot(req.query.index)

  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify({result:true}))
})

app.get('/getRunningBots', (req, res) => {
  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify(running_bots))
})

app.get('/rebootServer', (req, res) => {
  serverProcess.kill()

  res.set('Content-Type', 'text/plain')
  res.end(JSON.stringify(true))
})

app.get('/saveBotResults', (req, res) => {
  csvWriter
  .writeRecords(req.query.results)
  .then(()=> res.sendStatus(200))
})

/**
 * Server Activation
 */
var server = app.listen(port, () => {
  console.log(`Booting the robocode tankroyal servers`)

  // run server
  runServer()

  // run bots
  // runBots()

  //get available bots
  getAvailableBots()

  console.log(`Listening to requests on port ${port}`)
})

/**
 * Server private functions
*/
function sendMessage(process, pid, channel, message, name) {
  if(connection_ws) {
    var json = JSON.stringify({
      process: process,
      pid: pid,
      channel: channel,
      message: message,
      name: name
    })
    connection_ws.send(json)
  }
}

var server_port = process.env.SERVER_PORT
var server_ip = process.env.SERVER_IP
var botsecret = process.env.SERVER_SECRET_FOR_ROBOT
function runServer() {
  if(!serverProcess) {
    serverProcess = spawn("java", ["-jar", `${process.env.SERVERDIR}/robocode-tankroyale-server-${version}.jar`, `--port=${server_port}`, `--botSecrets=${botsecret}`, "--controllerSecrets=controllersecret"], { shell: true })

    serverProcess.stdout.on('data', (data) => {
      sendMessage('server',serverProcess.pid, 'stdout', `${data}`, 'Robocode Tankroyale Server')
    })

    serverProcess.stderr.on('data', (data) => {
      sendMessage('server',serverProcess.pid, 'stderr', `${data}`, 'Robocode Tankroyale Server')
    })

    serverProcess.on('close', (code) => {
      sendMessage('server',serverProcess.pid, 'close', `server process with PID ${serverProcess.pid} closed with code ${code}`, 'Robocode Tankroyale Server')
      serverProcess = false
      server_port = getRandomInt(1000, 8000)
      setTimeout(runServer, 2000)
    })
  }
}

function runBot(index) {
  var bot = available_bots[index]
  var bot_process = spawn('sh', [`${bot.path}/${bot.name}.sh`], { cwd: `${bot.path}`, shell: false,  env:{'SERVER_URL':`ws://${server_ip}:${server_port}`, 'SERVER_SECRET':botsecret }})

  bot_process.stdout.on('data', (data) => {
    sendMessage('bot',bot_process.pid, 'stdout', `${data}`, `${bot.name}`)
  })

  bot_process.stderr.on('data', (data) => {
    sendMessage('bot',bot_process.pid, 'stderr', `${data}`, `${bot.name}`)
  })

  bot_process.on('close', (code) => {
    sendMessage('bot',bot_process.pid, 'close', `${bot.name} process with PID ${bot_process.pid} closed with code ${code}`, `${bot.name}`)
  })

  var new_running_bot = {pid:bot_process.pid, index: index, name:bot.name}
  running_bots.push(new_running_bot)

  return(new_running_bot)
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

function getAvailableBots() {
  var index = 0
  bot_roots.forEach(root => {
    fs.readdirSync(root.path).forEach(bot_name => {
      // filtering the real bot directories
      var bot_path = `${root.path}/${bot_name}`
      var sh = `${bot_path}/${bot_name}.sh`
      var json = `${bot_path}/${bot_name}.json` 
      if(fs.existsSync(sh) && fs.existsSync(json)) {
        available_bots[index] = ({'index':index, 'tag':root.tag, 'name':bot_name, 'path':bot_path})
        index++
      }
    })
  })
}
