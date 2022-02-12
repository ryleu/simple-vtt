#!/usr/bin/env node

const http = require("http");
const fs = require("fs");

const extRe = /\.[a-z]+$/
const apiRe = /\/api/
const evilReqRe = /\.\./

const hostname = "127.0.0.1";
const port = 8080;

var board = {
  "pieces": [],
  "lines": []
};

const insults = [
  "I'm a teapot\nI serve pages, not the entire contents of my hard drive",
  "Sorry, but your mom is in the server room",
  "Nope, sorry, this can't be completed because your mom is nearby",
  "I'm too busy with your mom to send this file",
  "I'm trying to get your mom out of the refrigerator, please wait",
  "I've come to bargain - stop sending these requests, and I'll break down your wall for free so your mom can get in"
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
    console.log(msg);
    sockets.forEach(s => s.send(msg));
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
      res.setHeader("Content-Type", "application/json");
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
