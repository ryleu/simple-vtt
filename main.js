#!/usr/bin/env node

/*
COPYRIGHT (c) 2022 Riley <riley@ryleu.me>

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General
Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any
later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see
<https://www.gnu.org/licenses/>.
*/

console.log(
    "Copyright (c) 2022 Riley <riley@ryleu.me>\n" +
    "\n" +
    "This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero " +
    "General Public License as published by the Free Software Foundation, either version 3 of the License, or (at " +
    "your option) any later version.\n" +
    "\n" +
    "This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the " +
    "implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public " +
    "License for more details.\n" +
    "\n" +
    "You should have received a copy of the GNU Affero General Public License along with this program. If not, see " +
    "<https://www.gnu.org/licenses/>.\n"
);

const WebSocket = require('ws');
const MD5 = require("crypto-js/md5");
let httpOrS = "https"
if (process.env.HTTP === "true") {
    httpOrS = "http"
}
const https = require(httpOrS);
const fs = require("fs");
const apiRe = /\/api/;

function cacheFiles(head, fileList) {
    const outObj = {};

    for (let i = 0; i < fileList.length; i++) {
        switch (fileList[i].type) {
            case "file":
                let path = `${head}/${fileList[i].name}`;

                let contentType = "text/plain";
                const extension = path.split(".").pop();

                switch (extension) {
                    case "html":
                        contentType = "text/html";
                        break;
                    case "css":
                        contentType = "text/css";
                        break;
                    case "js":
                        contentType = "text/javascript";
                        break;
                    case "svg":
                        contentType = "image/svg+xml";
                        break;
                }

                try {
                    outObj[path] = { data: fs.readFileSync(path).toString(), type: contentType };
                } catch (e) {
                    if (e.errno === -2) {
                        outObj[path] = { data: "not found", type: "error" };
                    } else {
                        throw e;
                    }
                }
                break;
            case "dir":
                const toAppend = cacheFiles(`${head}/${fileList[i].name}`, fileList[i].files);
                const toAppendKeys = Object.keys(toAppend);

                for (let j = 0; j < toAppendKeys.length; j++) {
                    const toAppendKey = toAppendKeys[j];
                    outObj[toAppendKey] = toAppend[toAppendKey];
                }
        }
    }

    return outObj;
}

const Files = Object.freeze(cacheFiles("site", [
    { name: "index.html", type: "file" },
    { name: "index.js", type: "file" },
    { name: "style.css", type: "file" },
    { name: "favicon.ico", type: "file" },
    {
        name: "icons",
        type: "dir",
        files: [
            { name: "bucket.svg", type: "file" },
            { name: "cancel.svg", type: "file" },
            { name: "download.svg", type: "file" },
            { name: "gear.svg", type: "file" },
            { name: "pencil.svg", type: "file" },
            { name: "plus.svg", type: "file" },
            { name: "refresh.svg", type: "file" },
            { name: "trash.svg", type: "file" },
            { name: "undo.svg", type: "file" }
        ]
    },
    {
        name: "board",
        type: "dir",
        files: [
            { name: "index.html", type: "file" },
            { name: "index.js", type: "file" },
            { name: "style.css", type: "file" }
        ]
    }
]));

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

const config = httpOrS === "https" ? JSON.parse(fs.readFileSync("config.json").toString()) : {};
config.port = parseInt(process.env.PORT);

const auth = {};

if (httpOrS === "https") {
    auth.key = fs.readFileSync(config.auth.key);
    auth.cert = fs.readFileSync(config.auth.cert);
}

let sockets = [];
let sessions = {}


const server = https.createServer(auth, (req, res) => {
    console.log(`${req.headers["cf-connecting-ip"]} -> ${req.url}`);

    try {
        // Initial 200 status code
        res.statusCode = 200;

        // If this is an api request, use different handling
        if (req.url.match(apiRe)) {
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
                (url[1] ? url[1].split("&") : []).forEach((rawArg) => {
                    let arg = rawArg.split("=");
                    args[arg[0]] = arg[1];
                });

                switch (resource) {
                    case "/api/board/":
                        res.setHeader("Allow", "GET, PUT");
                        let id = args.id;
                        if (!args.id || !sessions[id]) {
                            res.statusCode = 403;
                            res.end("There is no session with that ID.");
                            break;
                        }

                        switch (req.method) {
                            case "GET":
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify(sessions[args.id].board));
                                break;
                            case "PUT":
                                if (req.headers["content-type"] !== "application/json") {
                                    res.statusCode = 400;
                                    res.end(noJson + "\nPlease use application/json");
                                    break;
                                }
                                let json;
                                try {
                                    json = JSON.parse(data);
                                } catch (e) {
                                    res.statusCode = 400;
                                    res.end(noJson + "\nYour JSON isn't JSON.");
                                    break;
                                }

                                if (json.dimensions === undefined ||
                                    json.pieces === undefined ||
                                    json.lines === undefined) {
                                    res.statusCode = 400;
                                    res.end(noJson + "\nYour JSON is dog poo.");
                                    break;
                                }

                                const pieceKeys = Object.keys(json.pieces);

                                if (json.pieceCount === undefined) {
                                    let highest = 0;

                                    for (let i = 0; i < pieceKeys.length; i++) {
                                        const piece = json.pieces[pieceKeys[i]];
                                        const pieceNumber = piece.id.split("-")[0] - 0;
                                        highest = Math.max(highest, pieceNumber);
                                    }
                                }

                                for (let i = 0; i < pieceKeys.length; i++) {
                                    if (json.pieces.pos === undefined) {
                                        const pos = json.pieces[pieceKeys[i]]._pos;
                                        json.pieces[pieceKeys[i]].pos = [pos.x, pos.y];
                                        delete json.pieces[pieceKeys[i]]._pos;
                                    }
                                }

                                sessions[args.id].board = json;

                                res.end("Successfully applied new board.");

                                sessions[args.id].sockets.forEach(s => s.send(`&B`));
                                break;
                            default:
                                res.statusCode = 405;
                                res.end();
                                break;
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

            return;
        }

        // Start building the file request path
        let path = "site" + req.url.split("?")[0];
        if (path[path.length - 1] === "/") {
            path += "index.html";
        }

        const fileData = Files[path];

        if (fileData === undefined || (fileData.type === "error" && fileData.data === "not found")) {
            res.statusCode = 404;
            res.end("not found");
        } else if (fileData.type === "error") {
            res.statusCode = 500;
            res.end(fileData.data);
        } else {
            res.setHeader("Content-Type", fileData.type);
            res.end(fileData.data);
        }
    } catch (e) {
        console.log(e);
    }
}).listen(config.port, (err) => {
    console.log(`Listening on 0.0.0.0:${config.port}`)
    const uid = parseInt(process.env.SUDO_UID);
    // Set our server's uid to that user
    if (uid) process.setuid(uid);
    console.log(`Server's UID is now ${process.getuid()}`);

    if (err) {
        console.error(err);
    }
});


const wss = new WebSocket.Server({server: server});
wss.on('connection', function(socket) {
    sockets.push(socket);

    // When you receive a message, send that message to every socket.
    socket.on('message', function(msg) {
        const msgStr = msg.toString();
        console.log(socket.sessionId, msgStr);

        try {
            const rawData = msgStr.split(";");
            const action = rawData[0].substring(1);
            const data = rawData.slice(1, rawData.length);

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

            let out = msgStr;


            switch (action) {
                case "S":
                    let board = sessions[socket.sessionId].board;
                    let id = `${board.pieceCount}-${MD5(board.pieceCount + data).toString()}`;

                    board.pieces[id] = {
                        "name": atob(data[0]),
                        "pos": parsePos(data[1]),
                        "icon": atob(data[2])
                    };

                    board.pieceCount++;
                    out = `&S;${id};${data[0]};${data[1]};${data[2]}`;
                    break;
                case "M":
                    sessions[socket.sessionId].board.pieces[data[0]].pos = parsePos(data[1]);
                    break;
                case "D":
                    delete sessions[socket.sessionId].board.pieces[data[0]];
                    break;
                case "L":
                    let pos1 = parsePos(data[0]);
                    let pos2 = parsePos(data[1]);
                    let thickness = data[2] - 0;
                    let color = data[3] ? data[3] : "#000000";

                    let posPair;

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

                    sessions[socket.sessionId].board.lines[posPair] = {
                        "pos1": pos1,
                        "pos2": pos2,
                        "thickness": thickness,
                        "color": color
                    };

                    out = `&L;${posPair};${data[0]};${data[1]};${data[2]};${data[3]}`;
                    break;
                case "R":
                    delete sessions[socket.sessionId].board.lines[data[0]];
                    break;
                case "B":
                    sessions[socket.sessionId].board.dimensions = parsePos(data[0]);
                    break;
                case "C":
                    sessions[socket.sessionId].board = defaultBoard();
                    out = "&B;30,15";
                    break;
                case "F":
                    let squareId = data[0].split(",").join("_");
                    let fillColor = data[1];
                    // TODO: add other fill patterns
                    let pattern = [].includes(data[2]) ? data[2] : "solid";
                    if (fillColor !== "reset") {
                        sessions[socket.sessionId].board.fill[squareId] = {
                            color: fillColor,
                            pattern: pattern
                        };
                    } else {
                        delete sessions[socket.sessionId].board.fill[squareId];
                    }
                    out = `&F;${data[0]};${fillColor};${pattern}`;
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
function parsePos(posStr) {
    const pos = posStr.split(",");
    return [pos[0] - 0, pos[1] - 0];
}

function toPosPair(pos1, pos2) {
    return pos1[0] + "_" + pos1[1] + "__" + pos2[0] + "_" + pos2[1];
}

function genInviteCode() {
    let b = "23456789ABCDEFGHJKMNPQRTUVWXYZabcdefghjkmnpqrtuvwxyz_"
    let base10 = Math.floor(Math.random() * Math.pow(10, 16));
    let output = "";
    while (base10 > 0) {
        output += b[base10 % b.length];
        base10 = Math.floor((base10 - (base10 % b.length)) / b.length);
    }
    return output.substring(output.length - 9, output.length - 1);
}

function defaultBoard() {
    return {
        dimensions: [30, 15],
        pieces: {},
        lines: {},
        pieceCount: 0,
        fill: {}
    };
}
