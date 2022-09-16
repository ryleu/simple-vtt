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

import * as ws from 'ws';
import crypto from "crypto-js";
import * as http from "http";
import fs from "fs";

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

const apiRe = /\/api/;

interface FileCacheReference {
    name: string;
    type: string;
}

class DirectoryCacheReference implements FileCacheReference {
    name: string;
    type = "dir";
    files: Array<DirectoryCacheReference | FileCacheReference>;

    constructor(name: string, files: Array<DirectoryCacheReference | FileCacheReference>) {
        this.name = name;
        this.files = files;
    }
}

function cacheFiles(head: string, fileList: Array<DirectoryCacheReference | FileCacheReference>): { [index: string]: {data: string, type: string} } {
    const outObj: { [index: string]: {data: string, type: string} } = {};

    fileList.forEach(file => {
        if (!(file instanceof DirectoryCacheReference)) {
            let path = `${head}/${file.name}`;

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
                    console.log("not found:", path);
                } else {
                    console.log(path);
                    throw e;
                }
            }
        } else {
            const toAppend = cacheFiles(`${head}/${file.name}`, file.files);
            const toAppendKeys = Object.keys(toAppend);

            toAppendKeys.forEach(toAppendKey => {
                outObj[toAppendKey] = toAppend[toAppendKey];
                console.log("cached", toAppendKey);
            });
        }
    });

    return outObj;
}

const Files = Object.freeze(cacheFiles("site", [
    { name: "index.html", type: "file" },
    { name: "index.js", type: "file" },
    { name: "style.css", type: "file" },
    { name: "favicon.ico", type: "file" },
    new DirectoryCacheReference(
        "icons",
        [
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
    ),
    new DirectoryCacheReference(
        "board",
        [
            { name: "index.html", type: "file" },
            { name: "index.js", type: "file" },
            { name: "style.css", type: "file" }
        ]
    )
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

const port = (n => (n >= 0 && n < 65536) ? n : 8080)(parseInt(process.env.PORT ?? ""));

type SocketPair = { socket: ws.WebSocket, sessionId: string | null }

let socketPairs: Array<SocketPair> = [];
let sessions: {[sessionId: string]: { socketPairs: Array<SocketPair>, board: Board, hasBeenLoaded: boolean }} = {};

const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    console.log(`user -> ${req.url}`);

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

                let args: { [index: string]: string } = {};
                (url[1] ? url[1].split("&") : []).forEach((rawArg) => {
                    let arg = rawArg.split("=");
                    args[arg[0]] = arg[1];
                });

                switch (resource) {
                    case "/api/board/":
                        res.setHeader("Allow", "GET, PUT");
                        let id = args.id;
                        if (!args.id || !sessions[id]) {
                            res.statusCode = 404;
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
                                let json: Board;
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

                                    pieceKeys.forEach(pieceKey => {
                                        const piece = json.pieces[pieceKey];
                                        const pieceNumber = parseInt(piece.id.split("-")[0]);
                                        highest = Math.max(highest, pieceNumber);
                                    });
                                }

                                pieceKeys.forEach(pieceKey => {
                                    if (json.pieces.pos === undefined) {
                                        const pos = json.pieces[pieceKey]._pos;
                                        json.pieces[pieceKey].pos = pos;
                                        delete json.pieces[pieceKey]._pos;
                                    }
                                });

                                sessions[args.id].board = json;

                                res.end("Successfully applied new board.");

                                sessions[args.id].socketPairs.forEach(sp => sp.socket.send(`&B`));
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
                                    socketPairs: [],
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
                        res.statusCode = 404;
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
}).listen(port, () => {
    console.log(`Listening on 0.0.0.0:${port}`);
}).addListener("error", (err: Error) => {
    console.error(err);
});


const wss = new ws.WebSocket.Server({server: server});
wss.on('connection', function(socket) {
    socketPairs.push({ socket: socket, sessionId: null});

    // When you receive a message, send that message to every socket.
    socket.on('message', function(msg) {
        const msgStr = msg.toString();
        
        let socketPair: SocketPair | null = null;

        socketPair = socketPairs.filter(sp => sp.socket === socket)[0];

        try {
            if (socketPair === null) throw Error("socketPair was left null somehow");

            console.log(socketPair.sessionId, msgStr);

            const rawData = msgStr.split(";");
            const action = rawData[0].substring(1);
            const data = rawData.slice(1, rawData.length);

            if (!socketPair.sessionId) {
                let id = data[0];
                if (action === "A" && sessions[id]) {
                    socketPair.socket.send(`${msgStr};true`);
                    socketPair.sessionId = id;
                    if (!sessions[id].socketPairs.map(sp => sp.socket).includes(socketPair.socket)) {
                        sessions[id].socketPairs.push(socketPair);
                    }
                } else if (!sessions[id]) {
                    socketPair.socket.send(`${msgStr};false`);
                    return;
                }
            }

            let out = msgStr;


            switch (action) {
                case "S":
                    let board = sessions[socketPair.sessionId].board;
                    let id = `${board.pieceCount}-${crypto.MD5(board.pieceCount.toString() + data).toString()}`;

                    board.pieces[id] = {
                        name: atob(data[0]),
                        pos: parsePos(data[1]),
                        icon: atob(data[2]),
                        id: id
                    };

                    board.pieceCount++;
                    out = `&S;${id};${data[0]};${data[1]};${data[2]}`;
                    break;
                case "M":
                    sessions[socketPair.sessionId].board.pieces[data[0]].pos = parsePos(data[1]);
                    break;
                case "D":
                    delete sessions[socketPair.sessionId].board.pieces[data[0]];
                    break;
                case "L":
                    let pos1 = parsePos(data[0]);
                    let pos2 = parsePos(data[1]);
                    let thickness = parseInt(data[2]);
                    let color = data[3] ? data[3] : "#000000";

                    let posPair: string;

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

                    sessions[socketPair.sessionId].board.lines[posPair] = {
                        "pos1": pos1,
                        "pos2": pos2,
                        "thickness": thickness,
                        "color": color
                    };

                    out = `&L;${posPair};${data[0]};${data[1]};${data[2]};${data[3]}`;
                    break;
                case "R":
                    delete sessions[socketPair.sessionId].board.lines[data[0]];
                    break;
                case "B":
                    sessions[socketPair.sessionId].board.dimensions = parsePos(data[0]);
                    break;
                case "C":
                    sessions[socketPair.sessionId].board = defaultBoard();
                    out = "&B;30,15";
                    break;
                case "F":
                    let squareId = data[0].split(",").join("_");
                    let fillColor = data[1];
                    // TODO: add other fill patterns

                    const possiblePatterns: Array<string> = []

                    let pattern = possiblePatterns.includes(data[2]) ? data[2] : "solid";
                    if (fillColor !== "reset") {
                        sessions[socketPair.sessionId].board.fill[squareId] = {
                            color: fillColor,
                            pattern: pattern
                        };
                    } else {
                        delete sessions[socketPair.sessionId].board.fill[squareId];
                    }
                    out = `&F;${data[0]};${fillColor};${pattern}`;
                    break;
                default:
                    return;
            }
            sessions[socketPair.sessionId].socketPairs.forEach((sp: SocketPair) => sp.socket.send(out));
        } catch (e) {
            console.error(e);
        }
    });

    // When a socket closes, or disconnects, remove it from the array.
    socket.on('close', function() {
        let socketPair: { socket: ws.WebSocket, sessionId: string | null } | null = null;

        socketPair = socketPairs.filter(sp => sp.socket === socket)[0];

        if (socketPair === null) return console.error("failed to remove socket", socket);

        socketPairs = socketPairs.filter(s => s.socket !== socket);
        if (socketPair.sessionId) {
            sessions[socketPair.sessionId].socketPairs = sessions[socketPair.sessionId].socketPairs.filter(s => s.socket !== socket);
        }
    });
});

function parsePos(posStr: string): Pos {
    const pos = posStr.split(",");
    return new Pos(parseFloat(pos[0]), parseFloat(pos[1]));
}

function toPosPair(pos1, pos2) {
    return pos1[0] + "_" + pos1[1] + "__" + pos2[0] + "_" + pos2[1];
}

function genInviteCode() {
    let b = "23456789ABCDEFGHJKMNPQRTUVWXYZabcdefghjkmnpqrtuvwxyz_";
    let base10 = Math.floor(Math.random() * Math.pow(10, 16));
    let output = "";

    // this is literally a base 10 to base however-long-b-is conversion
    while (base10 > 0) {
        output += b[base10 % b.length];
        base10 = Math.floor((base10 - (base10 % b.length)) / b.length);
    }
    return output.substring(output.length - 9, output.length - 1);
}

function defaultBoard(): Board {
    return {
        dimensions: new Pos(30, 15),
        pieces: {},
        lines: {},
        pieceCount: 0,
        fill: {}
    };
}


// TYPES //
interface Board {
    dimensions: Pos;
    pieces: {
        [index: string]: {
            id: string;
            name: string;
            icon: string;
            pos: Pos;
            _pos?: Pos;
        }
    };
    lines: {
        [index: string]: {
            pos1: Pos;
            pos2: Pos;
            thickness: number;
            color: string;
        }
    };
    fill: {
        [index: string]: {
            color: string;
            pattern: string;
        }
    };
    pieceCount: number;
}

class Pos {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this[0] = x;
        this.x = x;
        this[1] = y;
        this.y = y;
    }
}
