// app.js

/*
 * ACRONYMS:
 * RTR = Robocode Tank Royale
 * BOT = Robocode Bot
 * ENV = environmental variables and .env file
 */

/*
 * This is the server + API part of the software.
 * The main duties are:
 * - running RTR server
 * - running RTR BOTs
 * - acting as webserver serving web pages
 * - running RESTful API
 */

////////////////////START Required External Modules//////////////////////
// framework chosen for the job
const express = require("express");

// required for working with the system
const path = require("path");
const fs = require("fs");

// required for spawn and kill processes on the local machine
const { spawn, ChildProcess, exec, spawnSync } = require("child_process");
const { kill } = require("process");

// required to print out on the console
const { Console } = require("console");

// required for reading and writing the ENV
require("dotenv").config();

// required for writing CSV files
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

////////////////////END Required External Modules///////////////////

////////////////////START reading of .env file//////////////////////
// read the .env file
const app_port = process.env.APP_PORT;
var server_port = process.env.SERVER_PORT;
const server_ip = process.env.SERVER_IP;
const botsecret = process.env.SERVER_SECRET_FOR_ROBOT;
const version = process.env.VERSION;
const CSV_path = process.env.CSVPATH;
const port = process.env.APP_PORT;
const sample_bots_dir = process.env.SAMPLEBOTSDIR;
const custom_bots_dir = process.env.BOTDIRS;
////////////////////END reading of .env file//////////////////////

////////////////////START preparing the CSV file//////////////////

// building up the CSV file name based on the date of the day
//Ex: 08 October 2022 -> 08102022
const today = new Date();
const dd = String(today.getDate()).padStart(2, "0");
const mm = String(today.getMonth() + 1).padStart(2, "0"); //January is 0!
const yyyy = today.getFullYear();
const CSV_file_name = dd + mm + yyyy;

// creation of the CSV writer object
const csvWriter = createCsvWriter({
  path: `${CSV_path}/${CSV_file_name}.csv`,
  header: [
    { id: "id", title: "id" },
    { id: "name", title: "name" },
    { id: "version", title: "version" },
    { id: "rank", title: "rank" },
    { id: "lastSurvivorBonus", title: "last survivior bonus" },
    { id: "bulletDamage", title: "bullet damage" },
    { id: "bulletKillBonus", title: "bullet kill bonus" },
    { id: "ramDamage", title: "ram damage" },
    { id: "ramKillBonus", title: "ram kill bonus" },
    { id: "totalScore", title: "total score" },
    { id: "firstPlaces", title: "first places" },
    { id: "secondPlaces", title: "second places" },
    { id: "thirdPlaces", title: "third places" },
  ],
});

////////////////////END preparing the CSV file//////////////////////////////

/////////////////////START app variables and configuration//////////////////

// the main application!
const app = express();

// for reading the POST parameters
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// required for WebSockets
require("express-ws")(app);

// array of BOTs root directories with their tags
const bot_roots = [];

// Pushing in the bot_roots the root of the sample bots path, builded using both the SAMPLEBOTSDIR and the VERSION from the ENV
bot_roots.push({
  tag: `Sample Bots V${version}`,
  path: `${sample_bots_dir}/sample-bots-java-${version}`,
});

// Pushing in the bot_roots all the custom robot roots privided in the ENV
const bot_dirs_exploded = custom_bots_dir.split(";"); //spearating roots by ';'
if (!bot_dirs_exploded.length > 1) {
  bot_dirs_exploded.forEach((bots_dir) => {
    const bot_dir_exploded = bots_dir.split(","); //separating tag and root
    bot_roots.push({ tag: bot_dir_exploded[0], path: bot_dir_exploded[1] }); // piushing the object
  });
}

// array that will contain all the bots found scanning the bot_roots
// this array will be indexed with the same order number when the bot is added
// the index is used to identify what bot needs to be booted or killed
const available_bots = [];

// array that will contain all the running bots
var running_bots = [];

// this variable will keep the process object of the running RTR server
var serverProcess = false;

// this variable will keep the process object of the running booter process
var booterProcess = false;

// app configuration
app.set("views", path.join(__dirname, "views")); // setting the location of the views ak the web pages
app.set("view engine", "pug"); // setting the templating engine
app.use(express.static(path.join(__dirname, "public"))); // setting the '/' pointing to the public folder
app.use(
  "/jquery-ui",
  express.static(path.join(__dirname, "/node_modules/jquery-ui")),
); //setting '/jquery-ui' pointing to the jquery-ui npm module folder
app.use(
  "/fa",
  express.static(
    path.join(__dirname, "/node_modules/@fortawesome/fontawesome-free"),
  ),
); // setting '/fa' pinting to the font-awesome npm module folder

// one WebSocket for the communication with the frontend, default is false
var communication_ws = false;
/////////////////////START app variables and configuration//////////////////

/////////////////////START API routes//////////////////
// Routes Definitions
// TODO think about converting all RESTful calls in websocket calls

// '/' --> Webpage
app.get("/", (req, res) => {
  res.render("index", {
    title: "Robocode Tank Royale Web GUI",
    available_bots: available_bots,
    running_bots: running_bots,
    app_port: app_port,
  });
});

// '/api' --> establish a websocket connection, uses express-ws
app.ws("/api", (ws, req) => {
  communication_ws = ws;
});

// '/getServerPort' --> return the port of the server
app.get("/getServerPort", (req, res) => {
  res.set("Content-Type", "text/plain");
  res.end(JSON.stringify({ port: server_port }));
});

// '/rebootBots' --> reboot all current running bots processes
app.get("/rebootBots", (req, res) => {
  var indexes = [];

  // kill bots but save the indexes for the reboot
  running_bots.forEach((bot) => {
    spawn("pkill", ["-TERM", "-P", bot.pid]);
    indexes.push(bot.index);
  });
  running_bots = [];

  // boot the bots again
  var new_bot = {};
  indexes.forEach((index) => {
    new_bot = runBot(index);
  });

  // output message
  res.set("Content-Type", "text/plain");
  res.end(
    JSON.stringify({
      result: true,
      numberOfParticipants: indexes.length,
      new_bot: new_bot,
    }),
  );
});

// '/killAllBots' --> kill all running BOTs processes
app.get("/killAllBots", (req, res) => {
  // saving the indexes of the killed bots so I can send them in the response
  var indexes = [];
  running_bots.forEach((bot) => {
    spawn("pkill", ["-TERM", "-P", bot.pid]);
    indexes.push(bot.index);
  });
  running_bots = [];

  // output message
  res.set("Content-Type", "text/plain");
  res.end(JSON.stringify({ indexes: indexes }));
});

// '/runBot' --> run a bot using the array index
app.get("/runBot", (req, res) => {
  var running_bot = runBot(req.query.index);
  // console.log(running_bots)
  res.set("Content-Type", "text/plain");
  res.end(JSON.stringify(running_bot));
});

// '/getRunningBots' --> return the array of running bots
app.get("/getRunningBots", (req, res) => {
  res.set("Content-Type", "text/plain");
  res.end(JSON.stringify(running_bots));
});

// '/rebootServer' --> reboot the server process
app.get("/rebootServer", (req, res) => {
  // first let's kill the running server process
  serverProcess.kill();

  //second, we do nothing because the killing of the process is goung to trigger a new server process

  // output message
  res.set("Content-Type", "text/plain");
  res.end(JSON.stringify(true));
});

// '/saveBotResults' --> save the latest results in the currently open CSV file
app.get("/saveBotResults", (req, res) => {
  csvWriter.writeRecords(req.query.results).then(() => res.sendStatus(200)); // we send beck the response only when record is written
});

app.post("/addSID", (req, res) => {
  running_bots.forEach((running_bot) => {
    if (running_bot.pid == req.body.PID) running_bot.sid = req.body.SID;
  });
});
/////////////////////END API routes//////////////////

// the MAIN function of this application
var server = app.listen(port, () => {
  // run server
  runServer();

  // run the booter
  // console.debug(`Booting the bot booter`);
  // runBooter();

  // scan the bot_roots
  console.debug(`Scanning the bot_roots`);
  getAvailableBots();

  console.log(`Listening to requests on port ${port}`);
});

/////////////START Server private functions////////////////

/*
 * This function helps standardizing the messages sento via the communication WebSocket
 * process: string, name describing the kind of process that is sending the message (bot, server,...)
 * pid: int, the PID of the process
 * channel: string, stdout/stderr/close
 * message: string, the message to be sent
 * name: a friendly name of the sender
 */
function sendMessage(process, pid, channel, message, name) {
  // GATE: we send the message only if the websocket is active
  if (!communication_ws) return;

  // JSON object to send stringified
  var json = JSON.stringify({
    process: process,
    pid: pid,
    channel: channel,
    message: message,
    name: name,
  });

  // sending the message
  communication_ws.send(json);
}

/*
 * This function starts a RTR server and call itself when the server process closes untile the app is running
 */
function runServer() {
  // GATE: if the server process is already running we do nothing
  if (serverProcess) return;

  // booting the process in a shell
  console.debug(`Booting the server process with port ${server_port}`);
  serverProcess = spawn(
    "java -XX:+SuppressFatalErrorMessage",
    [
      "-jar",
      `${process.env.SERVERDIR}/robocode-tankroyale-server-${version}.jar`,
      `--port=${server_port}`,
      `--bot-secrets=${botsecret}`,
      "--controller-secrets=controllersecret",
      "--enable-initial-position"
    ],
    { shell: true },
  );

  // listening to STDOUT messages
  serverProcess.stdout.on("data", (data) => {
    // send the STDOUT message to the frontend
    // sendMessage(
    //   "server",
    //   serverProcess.pid,
    //   "stdout",
    //   `${data}`,
    //   "Robocode Tankroyale Server",
    // );

    console.log(`Server STDOUT: ${data}`);
  });

  // listening to STDERR messages
  serverProcess.stderr.on("data", (data) => {
    // send the STDERR message to the frontend
    sendMessage(
      "server",
      serverProcess.pid,
      "stderr",
      `${data}`,
      "Robocode Tankroyale Server",
    );
  });

  // listening to on process close
  serverProcess.on("close", (code) => {
    // send a CLOSE message to the frontend
    sendMessage(
      "server",
      serverProcess.pid,
      "close",
      `server process with PID ${serverProcess.pid} closed with code ${code}`,
      "Robocode Tankroyale Server",
    );

    // updating the serverProcess status to false
    serverProcess = false;

    // we do not check if the server closed process has already freed the used port, we just set a new random one
    server_port = getRandomInt(1000, 8000);

    // we boot a new server after waiting a small buffer of time
    setTimeout(runServer, 2000);
  });
}

/*
 * This function runs the bot booter process, will be used to boot the bots
 */
function runBooter() {
  // GATE: if the bot booter process is already running we do nothing
  if (booterProcess) return;

  // booting the process in a shell
  console.debug(`Booting the bot booter process`);
  booterProcess = spawn(
    "java",
    [
      "-jar",
      `robocode-tankroyale-booter-${version}.jar`,
      "boot",
      `${sample_bots_dir}/sample-bots-java-${version}`,
    ],
    {
      cwd: process.env.BOOTERDIR,
      shell: true,
      env: {
        SERVER_URL: `ws://${server_ip}:${server_port}`,
        SERVER_SECRET: botsecret,
        PATH: process.env.PATH,
      },
    },
  );

  console.debug("booterProcess", booterProcess);
  console.debug("booting Corners");
  booterProcess.stdin.setEncoding("utf-8");
  booterProcess.stdin.write("boot Corners");

  // listening to STDOUT messages
  booterProcess.stdout.on("data", (data) => {
    // send the STDOUT message to the frontend
    console.debug("BOOTER STDOUT", data.toString());
  });

  // listening to STDERR messages
  booterProcess.stderr.on("data", (data) => {
    // send the STDERR message to the frontend
    // sendMessage("booter", booterProcess.pid, "stderr", `${data}`, "Bot Booter");
    console.debug("BOOTER STDERR", data.toString());
  });

  // listening to on process close
  booterProcess.on("close", (code) => {
    // send a CLOSE message to the frontend
    // sendMessage(
    //   "booter",
    //   booterProcess.pid,
    //   "close",
    //   `booter process with PID ${booterProcess.pid} closed with code ${code} `,
    //   "Bot Booter",
    // );

    // updating the booterProcess status to false
    booterProcess = false;

    // we boot a new booter after waiting a small buffer of time
    // setTimeout(runBooter, 2000);
  });
}

/*
 * This function run a bot identofied by the index
 * index: int, index of the bot in the available_bots array
 */
function runBot(index) {
  // getting the bot data
  var bot = available_bots[index];

  // starting the bot process
  var bot_process = spawn("sh", [`${bot.name}.sh`], {
    cwd: `${bot.path}`,
    shell: false,
    env: {
      SERVER_URL: `ws://${server_ip}:${server_port}`,
      SERVER_SECRET: botsecret,
      PATH: process.env.PATH,
    },
  });

  // creating a new running bot object
  var new_running_bot = { pid: bot_process.pid, index: index, name: bot.name };

  // saving the object
  running_bots.push(new_running_bot);

  // listening to STDOUT messages
  bot_process.stdout.on("data", (data) => {
    // send the STDOUT message to the frontend
    sendMessage("bot", bot_process.pid, "stdout", `${data}`, `${bot.name}`);
  });

  // listening to STDERR messages
  bot_process.stderr.on("data", (data) => {
    // send the STDERR message to the frontend
    sendMessage("bot", bot_process.pid, "stderr", `${data}`, `${bot.name}`);
  });

  // listening to CLOSE messages
  bot_process.on("close", (code) => {
    // send a CLOSE message to the frontend
    sendMessage(
      "bot",
      bot_process.pid,
      "close",
      `${bot.name} process with PID ${bot_process.pid} closed with code ${code}`,
      `${bot.name}`,
    );
  });

  // return the new running bot object back to the caller
  return new_running_bot;
}

/*
 * helper function to get a random int in the range of [max,min)
 * min: number, minimum, included
 * max: number, maximum, excluded
 */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}

/*
 * scan the bot_roots for BOTs and save them into the available_bots array
 */
function getAvailableBots() {
  var index = 0; // very important, used for identifing the BOTs to boot or unboot
  bot_roots.forEach((root) => {
    fs.readdirSync(root.path).forEach((bot_name) => {
      // filtering the real bot directories
      var bot_path = `${root.path}/${bot_name}`;
      var sh = `${bot_path}/${bot_name}.sh`;
      var json = `${bot_path}/${bot_name}.json`;
      // checking if exists 1) a .sh file 2) a .json file, both with the name of the bot
      if (fs.existsSync(sh) && fs.existsSync(json)) {
        available_bots[index] = {
          index: index,
          tag: root.tag,
          name: bot_name,
          path: bot_path,
        };
        index++;
      }
    });
  });
}

/////////////END Server private functions////////////////
