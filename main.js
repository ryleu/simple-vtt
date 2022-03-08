#!/usr/bin/env node

const http = require("http");
const fs = require("fs");

const extRe = /\.[a-z]+$/
const apiRe = /\/api/
const evilReqRe = /\.\./

const hostname = "127.0.0.1";
const port = 8080;

var sprites = 0;

var board = {
  "dimensions": [20, 10],
  "pieces": {},
  "lines": {}
};

const insults = [
  "I'm a teapot\nI serve pages, not the entire contents of my hard drive.",
  "Sorry, but your mom is in the server room, I'm havng trouble reaching the data.",
  "Nope, sorry, this can't be completed because your mom is nearby. Her gravitational field has moved all of the drives out of reach.",
  "I'm too busy taking care of your mom to send this file.",
  "I'm trying to get your mom out of the refrigerator, please wait.",
  "I've come to bargain - stop sending these requests, and I'll break down your wall for free so your mom can fit through."
]

const WebSocket = require('ws');
const wss = new WebSocket.Server({
  port: 8081
});

let sockets = [];
wss.on('connection', function(socket) {
  sockets.push(socket);

  // When you receive a message, send that message to every socket.
  socket.on('message', function(msg) {
    var msgStr = msg.toString();
    console.log(msgStr);

    try {
      var rawData = msgStr.split(";");
      var action = rawData[0].substring(1);
      var data = rawData.slice(1, rawData.length);

      var out = msgStr;

      switch (action) {
        case "S":
          out = addSprite(data);
          break;
        case "M":
          moveSprite(data);
          break;
        case "D":
          deleteSprite(data);
          break;
        case "L":
          createLine(data);
          break;
        case "R":
          deleteLine(data);
          break;
        case "B":
          setDimensions(data);
          break;
        default:
          return;
      }
      sockets.forEach(s => s.send(out));
    } catch (e) {
      console.error(e);
    }
  });

  // When a socket closes, or disconnects, remove it from the array.
  socket.on('close', function() {
    sockets = sockets.filter(s => s !== socket);
  });
});

const server = http.createServer((req, res) => {
  // Initial 200 status code
  res.statusCode = 200;

  // If this is an api request, use different handling
  if (req.url.match(apiRe)) {
    return api(req,res);
  }

  // Start building the file request path
  var path = "site" + req.url;
  if (req.url.substring(-1) === "/") {
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
  switch (req.url) {
    case "/api/board":
      res.setHeader("Content-Type", "text/json");
      res.end(JSON.stringify(board));
      break;
    default:
      res.statusCode = 404
      res.setHeader("Content-Type", "text/plain");
      break;
  }
}

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});


function parsePos(posStr) {
  var pos = posStr.split(",");
  return [pos[0]-0, pos[1]-0];
}

function toPosPair(pos1, pos2) {
  return pos1[0]+"_"+pos1[1]+"__"+pos2[0]+"_"+pos2[1];
}

function addSprite(data) {
  var id = sprites;
  sprites++;
  var name = data[0];
  var pos = parsePos(data[1]);
  var icon = "";
  try {
    icon = atob(data[2]);
  }
  catch (e) {
    console.error(e);
  }

  board.pieces[id] = {
    "name": name,
    "pos": pos,
    "icon": icon
  };
  return "&S;"+id+";"+data[0]+";"+data[1]+";"+data[2];
}

function moveSprite(data) {
  var id = data[0];
  var pos = parsePos(data[1]);
  board.pieces[id].pos = pos;
}

function deleteSprite(data) {
  var id = data[0];
  delete board.pieces[id-0];
}

function createLine(data) {
  var pos1 = parsePos(data[0]);
  var pos2 = parsePos(data[1]);
  var thickness = data[2]-0;
  var color = data[3];

  if (!color) {
    color = "000000"
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
}

function deleteLine(data) {
  var posPair = data[0]+";"+data[1];
  delete board.lines[posPair];
}

function setDimensions(data) {
  var dims = parsePos(data[0]);
  board.dimensions = dims;
}
