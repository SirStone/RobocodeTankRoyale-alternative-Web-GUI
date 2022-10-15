**Robocode TankRoyale alternative web GUI**
# README

> *Build the best - destroy the rest!*

Cit: *flemming-n-larsen*

---

This is the _README_ for the RobocodeTankRoyale-alternative-Web-GUI,ugly mouthfull name, but whatever, it tells what it is: an attempt to build an alternative GUI for the programming game  [Robocode tank-royale](https://github.com/robocode-dev/tank-royale), a spin-off version of [Robocode](https://robocode.sourceforge.io/), my favourite programming game.

I write this _README_ 50% for the others and 50% for myself.

## GENERIC PROJECT TARGET

The target for this project is to build up an alternative GUI for the game Robocode tank-royale. Why? Because I want something that is following more my needs. I don't care about small complications (example: "writing paths in an .env file instead of having a graphic tool that allow me to do that), don't care about fancy graphics, I care to have 1-click-distance to what I need.

## SPECIFIC PROJECT TARGETS

- Server-Client architecture, The server runs the game server, the bots and the API, the client is a web application
- while I'm developing a new bot I want to be able to reboot it in an easy way in order to put in use the new code.
- I want to be able to save results and maybe other stuff in CSV files (on server) and download it from the frontend
- I want to be able to see the stdout and stderr of server and bots both in the frontend

## THE MAIN ACTORS

- server side
    - [nodejs](https://nodejs.org/en/), the server runtime
    - [npm](https://www.npmjs.com/), the packet manager
    - [expressjs](https://expressjs.com/), the server framework
    - JRE, required in order to run the Robocode tank-royale server
    - [pug](https://pugjs.org/api/getting-started.html), the templating framework, supperted by default by expressjs
    - minor parts: read the package.json file for these
- client side
    - html-css-javascript trio, is there someone that doesn't know about these?
    - [SASS](https://sass-lang.com/), CSS extension framework
    - [jquery](https://jquery.com/), powerfull javascript library
    - [jquery-ui](https://jqueryui.com/), jquery extension for grphics manipulation
    - [bulma](https://bulma.io/), CSS framework, the eye wants its share

## AKNOWLEDGE PROBLEMS

- messy and uncommented code
- work only in Firefox (last tested version is 105.0.3 64-Bit on MacOS Catalina 10.15.7)
- the "reboot bots" function is not working properly since I've switched the launching method of the bots
- the HTML5 canva has different position for the cardinalities, the battle is rendered reversed, but who cares?

## CURRENT PLAN

The application is doing everything I planned to a certain extent; at this moment I pushed through design problems without caring about doing good code, commenting the code or fixing non-stopping bugs, with the only aim of uderstanding if everything I wanted was possible to achieve and how. The plan is to continuosly refining the code where is found to be refined and keeping the documentation (this README) updated while adding and improving features.
Here's the planned TODO list, I will try to respect the ordering, from top to bottom, but I want to be free to jump from one to another as much as I want.

- [x] put this repo on github
- [x] write a nice README
- [x] fix "reboot bots" function
- [ ] add comments to all current code (index.js left)
- [ ] using the new session id, code a new ui for bot status updates
- [ ] making this WebUI working in chrome/chromium
- [ ] improve visual representation of the radar
- [ ] reboot/kill a single bot
- [ ] test running the server on a different machine. A slower network will make this UI unstable/unusable?

## INSTALL and RUN

I assume that [nodejs](https://nodejs.org/en/), [npm](https://www.npmjs.com/) and the JRE (Java Runtime Environment) are installed correctly and maybe updated to the lastest version.

In order to have an hopefully working install follow these steps first:
1. clone this repo
1. inside the cloned directory run `npm install` (my current version of npm is 8.19.1 and is working fine, if not, you are alone)
1. follow now the next CONFIGURATION part

## CONFIGURATION

There's a `.env` file downloded with the code where you can/need-to find/change some of the most important items that is required for correctly run all parts of the application. This one is fully commented so don't worry.

Where a path is requested use the current value in order to understand how to write it or use the full path from the root because should be more safe

You need to know about these items:
- `SERVERDIR`: It's the directory where the application will search for the jar for of the robocode server. This jar is not provided by the Robocode tank-royale directly but you need to extract it from the `robocode-tankroyale-gui.jar`.
Follow thee steps:
1. Download any version of `robocode-tankroyale-gui` from the [relases page](https://github.com/robocode-dev/tank-royale/releases)
1. extract it as you do with any compressed file
1. from the extracted directory copy the `robocode-tankroyale-server.jar` and paste it wherever it's comfortable for you and remember this directory, it's the one you need to use for the SERVERDIR in the .env file.
1. rename it adding the version of the server, for example, if the download gui is 0.17.1 rename the file as `robocode-tankroyale-server-0.17.1.jar`
1. update the .env file with
    
    `SERVERDIR="the folder where you put and renamed file"`
    
    Example: _SERVERDIR="/home/pippo/robocode-servers/"_
1. update the .env file vit the version

    `VERSION="the version you downloaded"`
    
    Example: _VERISON="0.17.1"_

After the install and configuration run `node app.js` inside the project directory.
If everything is fine you should see the message 
```Booting the robocode tankroyal servers Listening to requests on port 8000```
Just open a browser at the IP of the server and port 8000 and enjoy. (in case that you are working in localhost like me it's `http://localhost:8000`)

## ADDING BOTS

The bots are booted without the _booter_ utility used by the game, I've made this choice because I want to have access to _stderr_, _stdout_ and _stdin_ of the bot processes.

Also the bots are run launching the shell execuable script of the bot, so as far the bot starts when you run it with the script you wrote, so it will run from this application.

So far only _.sh_ files are used and the script must include all the required stuff for running your bot.

This section explain how to configure the bots directories.

I need to make a distinction, official sample bots and all other custom bots:

### sample bots

The sample bots are the basic bots provided by the authors of the game themselves, I like to have them always available so I've coded to load a specifi directory for these bots. This directory is configurable inside the .env file

`SAMPLEBOTSDIR=<directory of the sample bots>`

In this directory you need to put the root directory for the sample-bots of the version you require.

Example: If the version we are usign is _0.17.1_ and _SAMPLEBOTSDIR="/home/pippo/sample_bots"_ the server will try to read the bots in this directory:

_/home/pippo/sample_bots/sample-bots-java-0.17.1_

You can get the bots folder _sample-bots-java-0.17.1_ or whatever version from the [relases page of Robocode Tank-Royale](https://github.com/robocode-dev/tank-royale/releases).

You can have several versions of the sample-bots as several versions of the game server, the application will try to boot only the version indicated in the .env file

### custom bots

As the sample-bots if you want to have access to your custom bots you need to point in the .env file to a directory containing your bots and the application will make all bots folders (no check if it's a valid bot) available for run, after that if the bot really runs or fails is up to you to find out.

You can have different directories listed, and every directory tagged with a label you prefer in order to recognize the source folder later in the UI.

Here how you do it:

1. find `BOTDIRS` in the .env file
1. add all the directories in this way, example: _BOTSIRS="tag1,path1;tag2:path2"_

Remember, you need to point the directory containg your bots root directories, same way as the official game requires you to set up the _bot root directories_

Read the [booter](https://robocode-dev.github.io/tank-royale/articles/booter.html) section of the game to learn how to put together a funtcional bot directory

## DEVELOPING NOTES

Here same notes for developers, feel free to use or not.

- in the _package.json_ file there are hooks for improving the development experience:
    - `npm run dev` start a server that reloads when a change is detected in the server code
    - `npm run ui` start a browser page that reloads when changes are detected in the frontend code
    - `npm run css-build`(not to run manually) compiles SCSS into CSS
    - `npm run css-watch` run the `css-build` hook when a change is detected in the SCSS script

You you want contribute, please submit your suggestion/code/complain, I will answer with the timepace I can allow to these matters.

## ABOUT THE AUTHOR
### MY FREE TIME

This project is carried on as hobby but mainly I can cut out pieces of the week-ends and not every week-end; cause this is normality for me to spend minutes just to boot my computer and understand where I was, what I was doing and how to do it every time.

### MY FIRST GITHUB PROJECT

It's not that I've nerver used github or git, but never consistently an never judjeable by the public. With this project I would like to test myself and make experience of working in public, giving out expecations and expecting feedbacks, could happen that after a few months I will be bored from no feedbacks or from the project itself or overwhelmed by your expectations and drop the project right away.

## CREDITS

written by SirStone, sorry for my mistakes with english

## COPYRIGHTS

Feel free to clone this repo, modify it and/or include it in another project.
If you would like to be among the good people, just make a mentionion about me.
