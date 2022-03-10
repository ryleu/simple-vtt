#!/usr/bin/env node

const MD5 = require("crypto-js/md5");
const http = require("http");
const fs = require("fs");

const extRe = /\.[a-z]+$/;
const apiRe = /\/api/;
const evilReqRe = /\.\./;

let configData = JSON.parse(fs.readFileSync("config.json"));

let hostname = configData.hostname;
let port = configData.sitePort;
let wsLink = configData.wsLink;
let wsPort = configData.wsPort;

function defaultBoard() {
  return {
    "dimensions": [30, 15],
    "pieces": {},
    "lines": {},
    "pieceCount": 0
  };
}

let sessions = {}

const insults = [
  "I'm a teapot\nI serve pages, not the entire contents of my hard drive.",
  "Sorry, but your mom is in the server room, I'm havng trouble reaching the data.",
  "Nope, sorry, this can't be completed because your mom is nearby. Her gravitational field has moved all of the drives out of reach.",
  "I'm too busy taking care of your mom to send this file.",
  "I'm trying to get your mom out of the refrigerator, please wait.",
  "I've come to bargain - stop sending these requests, and I'll break down your wall for free so your mom can fit through."
];

const noJson =
  `———————————No JSON?——————————————————
⠀⣞⢽⢪⢣⢣⢣⢫⡺⡵⣝⡮⣗⢷⢽⢽⢽⣮⡷⡽⣜⣜⢮⢺⣜⢷⢽⢝⡽⣝
⠸⡸⠜⠕⠕⠁⢁⢇⢏⢽⢺⣪⡳⡝⣎⣏⢯⢞⡿⣟⣷⣳⢯⡷⣽⢽⢯⣳⣫⠇
⠀⠀⢀⢀⢄⢬⢪⡪⡎⣆⡈⠚⠜⠕⠇⠗⠝⢕⢯⢫⣞⣯⣿⣻⡽⣏⢗⣗⠏⠀
⠀⠪⡪⡪⣪⢪⢺⢸⢢⢓⢆⢤⢀⠀⠀⠀⠀⠈⢊⢞⡾⣿⡯⣏⢮⠷⠁⠀⠀
⠀⠀⠀⠈⠊⠆⡃⠕⢕⢇⢇⢇⢇⢇⢏⢎⢎⢆⢄⠀⢑⣽⣿⢝⠲⠉⠀⠀⠀⠀
⠀⠀⠀⠀⠀⡿⠂⠠⠀⡇⢇⠕⢈⣀⠀⠁⠡⠣⡣⡫⣂⣿⠯⢪⠰⠂⠀⠀⠀⠀
⠀⠀⠀⠀⡦⡙⡂⢀⢤⢣⠣⡈⣾⡃⠠⠄⠀⡄⢱⣌⣶⢏⢊⠂⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢝⡲⣜⡮⡏⢎⢌⢂⠙⠢⠐⢀⢘⢵⣽⣿⡿⠁⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠨⣺⡺⡕⡕⡱⡑⡆⡕⡅⡕⡜⡼⢽⡻⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣼⣳⣫⣾⣵⣗⡵⡱⡡⢣⢑⢕⢜⢕⡝⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣴⣿⣾⣿⣿⣿⡿⡽⡑⢌⠪⡢⡣⣣⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⡟⡾⣿⢿⢿⢵⣽⣾⣼⣘⢸⢸⣞⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠁⠇⠡⠩⡫⢿⣝⡻⡮⣒⢽⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
————————————————————————————————————`;

const WebSocket = require('ws');
const wss = new WebSocket.Server({
  port: wsPort
});

let sockets = [];
wss.on('connection', function(socket) {
  sockets.push(socket);

  // When you receive a message, send that message to every socket.
  socket.on('message', function(msg) {
    var msgStr = msg.toString();
    console.log(socket.sessionId, msgStr);

    try {
      var rawData = msgStr.split(";");
      var action = rawData[0].substring(1);
      var data = rawData.slice(1, rawData.length);

      if (!socket.sessionId) {
        let id = data[0];
        if (action === "A" && sessions[id]) {
          socket.send(msgStr);
          socket.sessionId = id;
          sessions[id].sockets.push(socket);
          sockets = sockets.filter(s => s !== socket);
        } else {
          return;
        }
      }

      var out = msgStr;

      switch (action) {
        case "S":
          out = addPiece(sessions[socket.sessionId].board, data);
          break;
        case "M":
          movePiece(sessions[socket.sessionId].board, data);
          break;
        case "D":
          deletePiece(sessions[socket.sessionId].board, data);
          break;
        case "L":
          out = createLine(sessions[socket.sessionId].board, data);
          break;
        case "R":
          deleteLine(sessions[socket.sessionId].board, data);
          break;
        case "B":
          setDimensions(sessions[socket.sessionId].board, data);
          break;
        case "C":
          out = clearBoard(sessions[socket.sessionId].board, data);
          break;
        default:
          return;
      }
      sessions[socket.sessionId].sockets.forEach(s => s.send(out));
    } catch (e) {
      console.error(e);
    }
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    sockets = sockets.filter(s => s !== socket);
    if (socket.sessionId) {
      sessions[socket.sessionId].sockets = sessions[socket.sessionId].sockets.filter(s => s !== socket);
    }
  });
});

const server = http.createServer((req, res) => {
  // Initial 200 status code
  res.statusCode = 200;

  // If this is an api request, use different handling
  if (req.url.match(apiRe)) {
    return api(req, res);
  }

  // Start building the file request path
  var path = "site" + req.url.split("?")[0];
  if (path[path.length - 1] === "/") {
    path += "index.html";
  }

  // If the path has funky spooky stuff in it, yeet it to the abyss
  if (path.match(evilReqRe)) {
    res.statusCode = 418;
    res.setHeader("Content-Type", "text/plain");
    res.end(insults[path.length % insults.length]);
    return;
  }

  // If the file has an extension (it always should), use it
  var extension = path.match(extRe);
  if (extension) {
    extension = extension[0];
  } else {
    extension = null;
  }

  // Set the correct content type based on the extension
  switch (extension) {
    case ".html":
      res.setHeader("Content-Type", "text/html");
      break;
    case ".css":
      res.setHeader("Content-Type", "text/css");
      break;
    case ".js":
      res.setHeader("Content-Type", "text/javascript");
      break;
    case ".svg":
      res.setHeader("Cache-Control", "private");
      res.setHeader("Content-Type", "image/svg+xml");
      break;
    default:
      res.setHeader("Content-Type", "text/plain");
      break;
  }

  // Read the file requested
  fs.readFile(path, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("not found");
    } else {
      res.end(data);
    }
  });
});

function api(req, res) {
  let data = "";
  req.on("data", chunk => {
    data += chunk;
  });
  req.on("end", () => {
    let url = req.url.split("?");
    let resource = url[0];
    if (resource[resource.length - 1] !== "/") {
      resource += "/";
    }
    let args = {};

    let rawArgs = (url[1]) ? url[1].split("&") : [];
    for (var i = 0; i < rawArgs.length; i++) {
      let arg = rawArgs[i].split("=");
      args[arg[0]] = arg[1];
    }

    switch (resource) {
      case "/api/board/":
        res.setHeader("Allow", "GET, PUT");
        let id = args.id;
        if (!id) {
          res.statusCode = 403;
          res.end("ID is required.");
          break;
        }
        if (!sessions[id]) {
          res.statusCode = 403;
          res.end("There is no session with that ID.");
          break;
        }

        switch (req.method) {
          case "GET":
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(sessions[id].board));
            break;
          case "PUT":
            if (req.headers["content-type"] !== "application/json") {
              res.statusCode = 400;
              res.end(noJson + "\nPlease use application/json");
              break;
            }
            var parsedJson;
            try {
              parsedJson = JSON.parse(data);
            } catch (e) {
              res.statusCode = 400;
              res.end(noJson + "\nYour JSON isn't JSON.");
              break;
            }

            if (parsedJson.dimensions === undefined ||
              parsedJson.pieces === undefined ||
              parsedJson.lines === undefined ||
              parsedJson.pieceCount === undefined) {
              res.statusCode = 400;
              res.end(noJson + "\nYour JSON is dog shit.");
              break;
            }

            sessions[id].board.dimensions = parsedJson.dimensions;
            sessions[id].board.pieces = parsedJson.pieces;
            sessions[id].board.lines = parsedJson.lines;
            sessions[id].board.pieceCount = parsedJson.pieceCount;

            res.end("Successfully applied new JSON.");

            sockets.forEach(s => s.send(`&B`));
            break;
          default:
            res.statusCode = 405;
            res.end();
            break;
        }
        break;
      case "/api/wslink/":
        res.setHeader("Allow", "GET");
        switch (req.method) {
          case "GET":
            res.setHeader("Content-Type", "application/json");
            res.end(`{"link": "${wsLink}"}`);
            break;
          default:
            res.statusCode = 405;
        }
        break;
      case "/api/new/":
        res.setHeader("Allow", "POST");
        switch (req.method) {
          case "POST":
            let invite = genInviteCode();
            sessions[invite] = {
              board: defaultBoard(),
              sockets: [],
              hasBeenLoaded: false
            };
            res.setHeader("Content-Type", "application/json");
            res.end(`{"invite": "${invite}"}`);
            break;
          default:
            res.statusCode = 405;
            res.end();
            break;
        }
        break;
      default:
        res.setHeader("Content-Type", "text/plain");
        res.statusCode = 404
        res.end();
        break;
    }
  });
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});


function parsePos(posStr) {
  var pos = posStr.split(",");
  return [pos[0] - 0, pos[1] - 0];
}

function toPosPair(pos1, pos2) {
  return pos1[0] + "_" + pos1[1] + "__" + pos2[0] + "_" + pos2[1];
}

function addPiece(board, data) {
  var id = `${board.pieceCount}-${MD5(board.pieceCount + data).toString()}`;
  board.pieceCount++;
  var pos = parsePos(data[1]);
  var icon = "";
  try {
    icon = atob(data[2]);
    var name = atob(data[0]);
  } catch (e) {
    console.error(e);
  }

  board.pieces[id] = {
    "name": name,
    "pos": pos,
    "icon": icon
  };
  return `&S;${id};${data[0]};${data[1]};${data[2]}`;
}

function movePiece(board, data) {
  var id = data[0];
  var pos = parsePos(data[1]);
  board.pieces[id].pos = pos;
}

function deletePiece(board, data) {
  var id = data[0];
  delete board.pieces[id];
}

function createLine(board, data) {
  var pos1 = parsePos(data[0]);
  var pos2 = parsePos(data[1]);
  var thickness = data[2] - 0;
  var color = data[3];

  if (!color) {
    color = "#000000"
  }

  var posPair;

  if (pos1[0] < pos2[0]) {
    posPair = toPosPair(pos1, pos2);
  } else if (pos2[0] < pos1[0]) {
    posPair = toPosPair(pos2, pos1);
  } else if (pos1[1] < pos2[1]) {
    posPair = toPosPair(pos1, pos2);
  } else if (pos2[1] < pos1[1]) {
    posPair = toPosPair(pos2, pos1);
  } else {
    return;
  }

  board.lines[posPair] = {
    "pos1": pos1,
    "pos2": pos2,
    "thickness": thickness,
    "color": color
  };

  return `&L;${posPair};${data[0]};${data[1]};${data[2]};${data[3]}`;
}

function deleteLine(board, data) {
  delete board.lines[data[0]];
}

function setDimensions(board, data) {
  var dims = parsePos(data[0]);
  board.dimensions = dims;
}

function clearBoard(board, data) {
  board.dimensions = [30, 15];
  board.pieces = {};
  board.lines = {};
  board.pieceCount = 0;

  return "&B;30,15";
}

function genInviteCode() {
  let b = "23456789ABCDEFGHJKMNPQRTUVWXYZabcdefghjkmnpqrtuvwxyz_"
  var base10 = Math.floor(Math.random() * Math.pow(10, 16));
  let output = "";
  while (base10 > 0) {
    output += b[base10 % b.length];
    base10 = Math.floor((base10 - (base10 % b.length)) / b.length);
  }
  return output;
}
