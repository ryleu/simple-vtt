/*
This file is part of simple-vtt.

simple-vtt is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public
License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later
version.

simple-vtt is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
details.

You should have received a copy of the GNU Affero General Public License along with simple-vtt. If not, see
<https://www.gnu.org/licenses/>.
*/

setScale(getScale());

document.getElementById("js-message")!!.style.display = "none"

let boardId = "";

// split up the stuff after the question mark (arguments) by &
boardId = document
    .URL
    .split("?")[1]!!
    .split("&")
    .map(arg => arg.split("="))
    .filter(splitArg => splitArg[0] === "id")[0][1];

// create an empty board
let board: ClientBoard = {
    dimensions: {x: 0, y: 0},
    pieces: {},
    lines: {},
    fill: {}
};


// <states>

enum States {
    NEUTRAL = "neutral", // nothing selected
    LINE_DRAW_A = "lineA", // line drawing, no point yet
    LINE_DRAW_B = "lineB", // line drawing, only 1 point
    PIECE_SELECTED = "piece", // piece selected
    DELETE = "delete", // delete mode
    ADD_PIECE_A = "addA", // add piece, no data yet
    ADD_PIECE_B = "addB", // add piece, no position yet
    FILL = "fill", // fill a tile with a color
}

// default state
let state = States.NEUTRAL;

/*
 * neutral -> null
 * line draw a -> null
 * line draw b -> LineDrawStateData
 * piece selected -> Piece
 * delete -> Piece | Line
 * add piece a -> null
 * add piece b -> AddPieceStateData
 * fill -> null
*/
let stateData: null | LineDrawStateData | Piece | Line | AddPieceStateData = null;

// </states>

// keep track of the grid in javascript so we don't have to repeatedly check the DOM
let elementGrid: Array<HTMLElement> = [];

// switches for prepping the board
let wsReady = false;
let jsonReady = false;

// various variables for managing the websocket URL
let websocketURL: string;
let splitURL = document.URL.split(":");
let overridePort = parseInt(splitURL[2]) !== NaN;

// determine the websocket URL
if (splitURL[0] === "https") {
    websocketURL = `wss://${document.URL.split("//")[1].split("/")[0]}${overridePort ? "" : ":443"}`;
} else {
    websocketURL = `ws://${document.URL.split("//")[1].split("/")[0]}${overridePort ? "" : ":80"}`;
}

let ws: WebSocket;

let pointerLine: Line;

let touchedLineButton = false;

// create the websocket. this is called whenever the websocket is destroyed or disconnected
function newWebSocket() {
    // use the URL we determined earlier
    let sock = new WebSocket(websocketURL);

    // when the socket is opened
    sock.onopen = () => {
        // try to connect to a board
        sock.send(`&A;${boardId}`);

        let body = document.getElementById("body") as HTMLBodyElement;
        let mainMenu = document.getElementById("main-menu") as HTMLDivElement;

        body.addEventListener("keyup", (event: KeyboardEvent) => {
            if (mainMenu.className === "menu") {
                switch (event.key) {
                    case "i":
                        setScale(Math.min(getScale() + 5, 300));
                        break;
                    case "o":
                        setScale(Math.max(getScale() - 5, 25));
                        break;
                    case "p":
                        document.getElementById("line-menu-open")!!.click()
                        break;
                    case "d":
                        document.getElementById("delete-menu-open")!!.click()
                        break;
                    case "a":
                        document.getElementById("piece-menu-open")!!.click()
                        break;
                    case "f":
                        document.getElementById("fill-menu-open")!!.click()
                        break;
                    case "s":
                    case "c":
                        document.getElementById("config-menu-open")!!.click()
                        break;
                }
            } else {
                switch (event.key) {
                    case "Escape":
                        let menuName = (document.getElementsByClassName("menu")[0] as HTMLDivElement).id.match(/[a-z]+-menu/)[0];
                        document.getElementById(`${menuName}-close`)?.click();
                }
            }
        });

        // make the main menu visible
        mainMenu.className = "menu";
        // remove the loading cursor
        body.style.cursor = "default";
        // make the board holder visible
        document.getElementById("board-holder")!!.style.display = "inherit";
        // display the invite code
        document.getElementById("invite-code")!!.innerHTML = `Invite:&nbsp;${boardId}`;
        // set up the download button
        let downloadButton = document.getElementById("config-menu-download")!! as HTMLAnchorElement;
        downloadButton.href = `/api/board/?id=${boardId}`;

        // when the download button is clicked...
        downloadButton.addEventListener("click", () => {
            const link = document.createElement("a");
            link.download = `board-${boardId}.json`;

            // if the socket is open, the webserver is probably available
            if (sock.readyState === sock.OPEN) {
                // create a download link and click it (because buttons can't have hrefs on some browsers I could mention)
                // fuck you, apple. webkit was never good and it never will be
                link.href = `/api/board/?id=${boardId}`;
            } else {
                // if the socket isn't open, something probably got messed up with the server, so we have to download based 
                //  on what the client thinks the board is like
                let fixedBoard: ServerBoard;
                
                // we have some conversions to do before this will work on the server...
                // first, we need to calculate pieceCount
                const pieceKeys = Object.keys(board.pieces);
                let pieceCount = 0;

                // while we're doing that, we migt as well convert the piece type
                let pieces: {
                    [index: string]: ServerPiece
                } = {};

                pieceKeys.forEach(pieceKey => {
                    const piece = board.pieces[pieceKey];
                    const pieceNumber = parseInt(piece.id.split("-")[0]);
                    pieceCount = Math.max(pieceCount, pieceNumber);

                    pieces[pieceKey] = {
                        id: piece.id,
                        name: piece.name,
                        icon: piece.icon,
                        pos: piece.pos
                    }
                });

                // next, we have to convert the line type
                let lines: {
                    [index: string]: ServerLine
                } = {};

                Object.keys(board.lines).forEach(lineKey => {
                    const line = board.lines[lineKey];

                    lines[lineKey] = {
                        pos1: line.pos,
                        pos2: line.pos2,
                        thickness: line.thickness,
                        color: line.color
                    }
                });

                // fills and dimensions are 1:1, so we should be good to go!

                fixedBoard = {
                    dimensions: board.dimensions,
                    background: board.background,
                    pieces: pieces,
                    lines: lines,
                    fill: board.fill,
                    pieceCount: pieceCount
                }

                // now just convert it to a string and download it
                //  thanks, SO user! https://stackoverflow.com/a/45831280
                link.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(fixedBoard))}`;
            }
            link.click();
        });

        // websocket setup is done, so we can set our switch
        wsReady = true;

        // <mapping-buttons> //

        // // add piece button
        document.getElementById("piece-menu-open")!!.addEventListener("click", () => {
            state = States.ADD_PIECE_A;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("piece-menu")!!.className = "menu";
        });

        // add piece cancel
        document.getElementById("piece-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("piece-menu")!!.className = "hidden-menu";

            // clear our piece menu when closing it
            (document.getElementById("piece-menu-name-input") as HTMLInputElement)!!.value = "";
            (document.getElementById("piece-menu-icon-input") as HTMLInputElement)!!.value = "";
            let img = document.getElementById("piece-menu-preview")!! as HTMLImageElement;
            img.title = "";
            img.src = "";
        });

        function previewPiece() {
            state = States.ADD_PIECE_B;
            stateData = new AddPieceStateData(
                (document.getElementById("piece-menu-name-input")!! as HTMLInputElement).value,
                (document.getElementById("piece-menu-icon-input")!! as HTMLInputElement).value
            )

            let img = document.getElementById("piece-menu-preview")!! as HTMLImageElement;
            img.title = stateData.name;
            img.src = stateData.icon;
        }

        // add piece preview
        document.getElementById("piece-menu-name-input")!!.addEventListener("change", previewPiece);
        document.getElementById("piece-menu-icon-input")!!.addEventListener("change", previewPiece);


        // // add line button
        document.getElementById("line-menu-open")!!.addEventListener("click", () => {
            state = States.LINE_DRAW_A;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("line-menu")!!.className = "menu";
        });

        document.getElementById("line-menu-open")!!.addEventListener("touchstart", () => {
            touchedLineButton = true;
        });

        // add line cancel
        document.getElementById("line-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("line-menu")!!.className = "hidden-menu";

            pointerLine.updateData(new Pos(0, 0), new Pos(0, 0), 0, "#000000");
            touchedLineButton = false;
        });


        // // add fill button
        document.getElementById("fill-menu-open")!!.addEventListener("click", () => {
            state = States.FILL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("fill-menu")!!.className = "menu";
        });

        // add line cancel
        document.getElementById("fill-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("fill-menu")!!.className = "hidden-menu";
        });


        // // delete button
        document.getElementById("delete-menu-open")!!.addEventListener("click", () => {
            state = States.DELETE;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("delete-menu")!!.className = "menu";
        });

        // delete cancel
        document.getElementById("delete-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("delete-menu")!!.className = "hidden-menu";
        });


        // // config button
        document.getElementById("config-menu-open")!!.addEventListener("click", () => {
            // populate the dimensions and scale input fields
            (document.getElementById("config-menu-scale-input")!! as HTMLInputElement).value = getScale().toString();
            (document.getElementById("config-menu-dims-input-x")!! as HTMLInputElement).value = board.dimensions.x.toString();
            (document.getElementById("config-menu-dims-input-y")!! as HTMLInputElement).value = board.dimensions.y.toString();
            (document.getElementById("config-menu-background-input-url")!! as HTMLInputElement).value = board.background?.image ?? "";
            (document.getElementById("config-menu-background-input-width")!! as HTMLInputElement).value = (board.background?.width ?? 1).toString();

            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("config-menu")!!.className = "menu";
        });

        // config cancel
        document.getElementById("config-menu-close")!!.addEventListener("click", () => {
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("config-menu")!!.className = "hidden-menu";

            refreshBackground();
        });

        // config scale
        document.getElementById("config-menu-scale-input")!!.addEventListener("change", () => {
            let inputElement = (document.getElementById("config-menu-scale-input")!! as HTMLInputElement);
            let scaleInput = parseInt(inputElement.value);

            if (scaleInput < 25) {
                inputElement.value = "25";
                scaleInput = 25;
            } else if (scaleInput > 300) {
                inputElement.value = "300";
                scaleInput = 300;
            }
            setScale(Math.round(scaleInput));
        });

        // config background
        let backgroundUrlElement = (document.getElementById("config-menu-background-input-url")!! as HTMLInputElement);
        let backgroundWidthElement = (document.getElementById("config-menu-background-input-width")!! as HTMLInputElement);

        function updateBackground() {
            if (parseInt(backgroundWidthElement.value) < 1) {
                backgroundWidthElement.value = "1";
            }

            if (backgroundUrlElement.value !== "") {
                getBoardElement().style.backgroundImage = `url("${backgroundUrlElement.value}")`;
                getRootElement().style.setProperty("--grid-on", "1");
                getRootElement().style.setProperty("--square-background-color", "transparent");
            } else {
                getBoardElement().style.backgroundImage = "none";
                getRootElement().style.setProperty("--grid-on", "0");
                getRootElement().style.setProperty("--square-background-color", "var(--main-color)");
            }

            getRootElement().style.setProperty("--background-width", backgroundWidthElement.value);
        }

        backgroundUrlElement.addEventListener("change", updateBackground);
        backgroundWidthElement.addEventListener("change", updateBackground);

        document.getElementById("config-menu-background-apply")!!.addEventListener("click", () => {
            sock.send(`&G;${btoa(backgroundUrlElement.value)};${backgroundWidthElement.value}`);
            document.getElementById("config-menu-close")!!.click();
        });

        // config dimensions
        document.getElementById("config-menu-dims-apply")!!.addEventListener("click", () => {
            let xInputElement = (document.getElementById("config-menu-dims-input-x")!! as HTMLInputElement)
            let yInputElement = (document.getElementById("config-menu-dims-input-y")!! as HTMLInputElement)

            let dimsInputX = parseFloat(xInputElement.value);
            let dimsInputY = parseFloat(yInputElement.value);

            // clamp our values
            if (dimsInputX >= 1 && dimsInputX <= 100 && dimsInputY >= 1 && dimsInputY <= 75 && (dimsInputX % 1 === 0) && (dimsInputY % 1 === 0)) {
                sock.send(`&B;${dimsInputX},${dimsInputY}`);
                return;
            }

            // set them in the UI if they're too large or too small or not integers
            if (dimsInputX < 1) {
                xInputElement.value = "1";
            } else if (dimsInputX > 100) {
                xInputElement.value = "100";
            } else if (dimsInputX % 1 !== 0) {
                xInputElement.value = Math.round(dimsInputX).toString();
            }

            if (dimsInputY < 1) {
                yInputElement.value = "1";
            } else if (dimsInputY > 75) {
                yInputElement.value = "75";
            } else if (dimsInputY % 1 !== 0) {
                xInputElement.value = Math.round(dimsInputY).toString();
            }
        });

        // config reset
        document.getElementById("config-menu-reset")!!.addEventListener("click", () => {
            sock.send("&C");
        });

        // config upload
        document.getElementById("config-menu-upload-apply")!!.addEventListener("click", () => {
            let inputElement = document.getElementById("config-menu-upload-input")!! as HTMLInputElement;
            let file = inputElement.files?.item(0);
            if (file) {
                file.text().then(value => {
                    inputElement.value = "";
                    fetch(`/api/board/?id=${boardId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: value
                    });
                });
            }
        });

        // config upload selected file
        document.getElementById("config-menu-upload-input")!!.addEventListener("input", () => {
            let labelElement = document.getElementById("config-menu-upload-selected")!!;
            let file = (document.getElementById("config-menu-upload-input")!! as HTMLInputElement).files?.item(0);
            if (file) {
                labelElement.textContent = file.name;
            } else {
                labelElement.textContent = "No file selected...";
            }
        });

        // </mapping-buttons> //

        pointerLine = new Line("pointer", new Pos(0, 0), new Pos(0, 0), 0, "#000000");
    };

    sock.onmessage = (msg) => {
        let rawData = msg.data.split(";");
        let action = rawData[0].substring(1);
        let data = rawData.slice(1, rawData.length);

        switch (action) {
            case "S": // Add piece
                board.pieces[data[0]] = new Piece(
                    data[0], // id
                    atob(data[1]), // base64 name
                    Pos.fromString(data[2]), // position
                    atob(data[3]) // base64 icon url
                );
                break;
            case "M": // Move piece
                board.pieces[data[0]].pos = Pos.fromString(data[1]);
                break;
            case "D": // Delete piece
                board.pieces[data[0]].remove();
                delete board.pieces[data[0]];
                break;
            case "L": // Add line
                board.lines[data[0]] = new Line(
                    data[0], // id
                    Pos.fromString(data[1]), // first position
                    Pos.fromString(data[2]), // second position
                    data[3] - 0, // thickness
                    data[4] // color
                );
                break;
            case "R": // Delete line
                board.lines[data[0]].remove();
                delete board.lines[data[0]];
                break;
            case "B": // Resize board
                window.location.reload(); // jk, that's too hard, just refresh
                break;
            case "F":
                let squarePos = Pos.fromString(data[0]);
                let squareId = `${squarePos.x}_${squarePos.y}`;
                let color = data[1];
                let square = document.getElementById(`square-${squarePos.y - 1}-${squarePos.x - 1}`);
                if (square === null) {
                    window.location.reload();
                    return;
                }
                if (color !== "reset") {
                    board.fill[squareId] = {
                        color: color,
                        pattern: data[2]
                    };

                    square.style.backgroundColor = color.toString();
                } else {
                    delete board.fill[squareId];
                    square.style.backgroundColor = "var(--square-background-color)";
                }
                break;
            case "A":
                if (data[1] !== "true") {
                    document.getElementById("invite-code")!!.innerHTML = "Websocket&nbsp;Error";
                } else {
                    sock.onclose = () => {
                        document.getElementById("invite-code")!!.innerHTML = "DISCONNECTED";
                        sock.onclose = () => {};
                        sock.close();
                        ws = newWebSocket();
                    };
                }
                break;
            case "G":
                let boardImage = atob(data[0]);
                let boardWidth = parseInt(data[1]);

                board.background = {
                    image: boardImage,
                    width: boardWidth
                };

                refreshBackground();
        }
    };

    return sock;
}

ws = newWebSocket();

fetch(`/api/board/?id=${boardId}`)
    .then(response => {
        if (response.ok) {
            response.json().then((json: ServerBoard) => {
                board.dimensions = json.dimensions;
                board.fill = json.fill;
                board.background = json.background;
                refreshBackground();
                renderBoard(json.dimensions.x, json.dimensions.y);
            
                Object.keys(json.pieces).forEach((pieceId) => {
                    let piece = json.pieces[pieceId];
                    board.pieces[pieceId] = new Piece(
                        pieceId,
                        piece.name,
                        piece.pos,
                        piece.icon
                    );
                });
            
                Object.keys(json.lines).forEach((lineId) => {
                    let line = json.lines[lineId];
                    board.lines[lineId] = new Line(
                        lineId,
                        line.pos1 as Pos,
                        line.pos2 as Pos,
                        line.thickness,
                        line.color
                    );
                });
            
                jsonReady = true;
            });
        } else {
            // display an error
            document.getElementById("invite-code")!!.innerHTML = `Board&nbsp;${response.status}`;
            jsonReady = true;
        }
    });

// RENDERING //

// this is the amount of subdivisions each tile gets
const subScale = 0.25;


// LOGIC FUNCTIONS //

// massive function to draw the tiles
function renderBoard(x: number, y: number) {
    for (let i = elementGrid.length - 1; i > -1; i--) {
        for (let j = elementGrid[i].children.length - 1; j > -1; j--) {
            elementGrid[i].children[j].remove();
            delete elementGrid[i][j];
        }
        elementGrid[i].remove();
        delete elementGrid[i];
    }

    let tempGrid: Array<HTMLDivElement> = [];

    for (let i = 0; i < y; i++) {
        let row = document.createElement("div");
        row.className = "row";
        row.id = "row-" + i;
        row.style.width = `calc(var(--scale) * ${x}px)`;
        row.style.top = `calc(var(--scale) * ${i}px)`;

        for (let j = 0; j < x; j++) {
            let square = document.createElement("div");
            square.className = "square";
            square.id = `square-${i}-${j}`;

            // get the alternate fill color (if it exists)
            let altFill = board.fill[`${j+1}_${i+1}`];
            if (altFill !== undefined) {
                square.style.backgroundColor = altFill.color;
            }

            // this is some basic chess board color logic
            square.style.left = `calc(var(--scale) * ${j}px)`;

            let button = document.createElement("button");
            button.className = "square-button";
            button.id = `square-button-${i}-${j}`;
            if ((i + j) % 2 === 0) {
                // I'm using an overlay here so that the color will change with any
                // background color
                button.style.backgroundColor = "var(--grid-alt-color)";
            }

            function posFromEvent(event: MouseEvent) {
                let targetId = button.id.split("-");

                return new Pos(
                    parseInt(targetId[3]) + subScale * Math.round(event.offsetX / (getScale() * subScale)),
                    parseInt(targetId[2]) + subScale * Math.round(event.offsetY / (getScale() * subScale))
                );
            }

            button.addEventListener("click", (event: MouseEvent) => clickEvent(posFromEvent(event)));
            button.addEventListener("mousemove", (event: MouseEvent) => mouseMoveEvent(posFromEvent(event)));

            square.appendChild(button);
            row.appendChild(square);
        }
        getBoardElement().appendChild(row);
        getBoardElement().style.width = `calc(var(--scale) * ${x}px)`;
        getBoardElement().style.height = `calc(var(--scale) * ${y}px + 100px)`;
        tempGrid.push(row);
    }

    elementGrid = tempGrid;
}

// massive function to manage clicks
function clickEvent(pos: Pos) {
    // Offset by the subscale so that you can place lines on square edges
    let linePos = new Pos(pos.x + subScale, pos.y + subScale);
    let piecePos = new Pos(Math.floor(pos.x) + 1, Math.floor(pos.y) + 1);

    switch (state) {
        case States.PIECE_SELECTED:
            if (!(stateData instanceof Piece)) return;
            ws.send(`&M;${stateData.id};${piecePos.x},${piecePos.y}`);
            break;
        case States.LINE_DRAW_A:
            stateData = new LineDrawStateData(
                parseInt((document.getElementById("line-menu-thickness-input")!! as HTMLInputElement).value),
                (document.getElementById("line-menu-color-input")!! as HTMLInputElement).value,
                Object.freeze(linePos),
                function(pos2) {
                    if (!(stateData instanceof LineDrawStateData)) return;
                    ws.send(
                        `&L;${stateData.pos.x},${stateData.pos.y};` +
                        `${pos2.x},${pos2.y};` +
                        `${stateData.thickness};${stateData.color}`
                    );
                }
            )
            state = States.LINE_DRAW_B;
            break;
        case States.LINE_DRAW_B:
            if (!(stateData instanceof LineDrawStateData)) return;
            stateData.drawLine(linePos);
            stateData = null;
            state = States.LINE_DRAW_A;
            break;
        case States.ADD_PIECE_B:
            if (!(stateData instanceof AddPieceStateData)) return;
            ws.send(
                `&S;${btoa(stateData.name)};` +
                `${piecePos.x},${piecePos.y};` +
                `${btoa(stateData.icon)}`
            );
            break;
        case States.FILL:
            let color = (document.getElementById("fill-menu-color-input")!! as HTMLInputElement).value;
            ws.send(`&F;${piecePos.x},${piecePos.y};${color};solid`);
            break;
        case States.DELETE:
            ws.send(`&F;${piecePos.x},${piecePos.y};reset;solid`);
            break;
    }
}

function mouseMoveEvent(pos: Pos) {
    if (touchedLineButton) return;
    if (pointerLine === undefined) return;

    let alignedPos = new Pos(
        pos.x + subScale,
        pos.y + subScale
    )

    switch (state) {
        case States.LINE_DRAW_A:
            pointerLine.updateData(
                alignedPos,
                alignedPos,
                parseInt((document.getElementById("line-menu-thickness-input")!! as HTMLInputElement).value),
                (document.getElementById("line-menu-color-input")!! as HTMLInputElement).value
            );
        case States.LINE_DRAW_B:
            if (!(stateData instanceof LineDrawStateData)) return;
            pointerLine.updateData(
                stateData.pos,
                alignedPos,
                stateData.thickness,
                stateData.color
            );
    }
}


// HELPER FUNCTIONS //

function refreshBackground() {
    let image = board.background?.image ?? "";
    let width = board.background?.width ?? 1;

    if (image !== "") {
        getBoardElement().style.backgroundImage = `url("${image}")`;
        getRootElement().style.setProperty("--grid-on", "1");
        getRootElement().style.setProperty("--square-background-color", "transparent");
    } else {
        getBoardElement().style.backgroundImage = "none";
        getRootElement().style.setProperty("--grid-on", "0");
        getRootElement().style.setProperty("--square-background-color", "var(--main-color)");
    }

    getRootElement().style.setProperty("--background-width", width.toString());
}

// get the element for the board
function getBoardElement() {
    return document.getElementById("board") as HTMLDivElement;
}

function getRootElement() {
    return document.querySelector(':root') as HTMLElement;
}

// get the width of each tile
function getScale(): number {
    let scale = localStorage.getItem("scale");
    if (scale === null) {
        setScale(100);
        return getScale();
    }
    return parseInt(scale);
}

function setScale(newScale: number) {
    localStorage.setItem("scale", newScale.toString());
    (document.querySelector(':root') as HTMLElement).style.setProperty("--scale", newScale.toString());
}

// convert cartesian coordinates to polar
function cartesianToPolar(x: number, y: number) {
    let distance = Math.sqrt(x * x + y * y);
    let radians = Math.atan2(y, x); // This takes y first
    return {
        distance: distance,
        radians: radians
    };
}

// convert polar coordinates to cartesian
function polarToCartesian(distance: number, radians: number) {
    return new Pos(Math.cos(radians) * distance, Math.sin(radians) * distance);
}

// DATA TYPE CLASSES //

class Line {
    id: string;
    length: number;
    angle: number;
    pos: Pos;
    pos2: Pos;
    thickness: number;
    color: string;
    element: HTMLButtonElement;

    constructor(id: string, pos1: Pos, pos2: Pos, thickness: number, color: string) {
        this.id = id;

        this.element = document.createElement("button");

        this.element.addEventListener("click", (event: MouseEvent) => {
            switch (state) {
                case States.DELETE:
                    stateData = this;
                    ws.send(`&R;${this.id}`);
                    break;
                default:
                    clickEvent(this.posFromEvent(event));
            }
        });

        this.element.addEventListener("mousemove", (event: MouseEvent) => mouseMoveEvent(this.posFromEvent(event)));

        this.element.className = "line";
        this.element.id = `line-${this.id}`;

        this.updateData(pos1, pos2, thickness, color);

        getBoardElement().appendChild(this.element);
    }

    private posFromEvent(event: MouseEvent): Pos {
        // offsetX is needed here because it works the same way in Firefox, Chromium, and WebKit
        const relPos = polarToCartesian(event.offsetX, this.angle);

        // Remember: the click is offset by the subscale
        return new Pos(
            this.pos.x + subScale * (Math.round(relPos.x / (getScale() * subScale)) - 1),
            this.pos.y + subScale * (Math.round(relPos.y / (getScale() * subScale)) - 1)
        );
    }

    updateData(pos1: Pos, pos2: Pos, thickness: number, color: string) {
        let polPos = cartesianToPolar(pos2.x - pos1.x, pos2.y - pos1.y);

        this.length = polPos.distance;
        this.angle = polPos.radians;

        this.pos = pos1;
        this.pos2 = pos2;
        this.thickness = thickness;
        this.color = color;

        this.element.style.width = `calc(var(--scale) * ${this.length}px)`;
        this.element.style.height = `calc(var(--scale) * ${thickness}px / 15)`;

        this.element.style.backgroundColor = color;
        this.element.style.borderColor = color;
        // transform because the actual value is offset by the subscale
        this.element.style.transform =
            `translateY(calc(var(--scale) * (-${thickness}px / 30 - ${subScale}px)))` +
            `translateX(calc(var(--scale) * -${subScale}px))` +
            `rotate(${this.angle}rad)`;

        this.element.style.left = `calc(${this.pos.x}px * var(--scale))`;
        this.element.style.top = `calc(${this.pos.y}px * var(--scale))`;
    }

    remove() {
        if (stateData === this) {
            stateData = null;
        }
        this.element.remove();
    }
}

class Piece {
    id: string;
    name: string;
    icon: string;
    image: HTMLImageElement;
    element: HTMLButtonElement;
    _pos: Pos;

    constructor(id: string, name: string, pos: Pos, icon: string) {
        this.id = id;
        this.name = name;
        this.icon = icon;

        // create the element on the page
        this.image = document.createElement("img");
        this.element = document.createElement("button");

        this.element.addEventListener('click', (event: MouseEvent) => {
            let selectedPieces = document.getElementsByClassName("selected-piece");

            switch (state) {
                case States.PIECE_SELECTED:
                    if (stateData === this) {
                        state = States.NEUTRAL;
                        while (selectedPieces.length > 0) {
                            selectedPieces[0].className = "piece";
                        }
                        stateData = null;
                    } else {
                        state = States.NEUTRAL;
                        while (selectedPieces.length > 0) {
                            selectedPieces[0].className = "piece";
                        }
                    }
                    break;
                case States.NEUTRAL:
                    state = States.PIECE_SELECTED;
                    while (selectedPieces.length > 0) {
                        selectedPieces[0].className = "piece";
                    }
                    stateData = this;
                    this.element.className = "selected-piece";
                    break;
                case States.DELETE:
                    stateData = this;
                    ws.send(`&D;${this.id}`);
                    break;
                default:
                    clickEvent(this.posFromEvent(event));
            }
        });

        this.element.addEventListener("mousemove", (event: MouseEvent) => mouseMoveEvent(this.posFromEvent(event)));

        this.image.className = "piece-image";
        this.image.id = `piece-image-${id}`;
        this.image.style.width = "calc(var(--scale) * 1px)";
        this.image.style.height = "calc(var(--scale) * 1px)";
        this.image.src = icon;
        this.element.appendChild(this.image);

        this.element.className = "piece";
        this.element.id = `piece-${id}`;
        this.element.title = name;

        this.element.style.width = "calc(var(--scale) * 1px)";
        this.element.style.height = "calc(var(--scale) * 1px)";

        this.pos = pos;
    }

    private posFromEvent(event: MouseEvent): Pos {
        return new Pos(
            (this.pos.x - 1) + subScale * Math.round(event.offsetX / (getScale() * subScale)),
            (this.pos.y - 1) + subScale * Math.round(event.offsetY / (getScale() * subScale))
        );
    }

    set pos(newPos) {
        if (stateData === this) {
            this.element.className = "piece";
            state = States.NEUTRAL;
            stateData = null;
        }
        this._pos = newPos;
        this.remove();
        this.element.style.left = `calc(var(--scale) * ${newPos.x - 1}px)`;

        try {
            elementGrid[newPos.y - 1].appendChild(this.element);
        } catch (e) {
            console.error(newPos);
            console.error(e);
            ws.send(`&D;${this.id}`);
        }
    }

    get pos() {
        return this._pos;
    }

    remove() {
        if (stateData === this) {
            stateData = null;
        }
        this.element.remove();
    }
}

class AddPieceStateData {
    name: string;
    icon: string;

    constructor(name: string, icon: string) {
        this.name = name;
        this.icon = icon;
    }
}

class LineDrawStateData {
    thickness: number;
    color: string;
    pos: Pos;
    drawLine: (pos2: Pos) => void

    constructor(thickness: number, color: string, pos: Pos, drawLine: (pos2: Pos) => void) {
        this.thickness = thickness;
        this.color = color;
        this.pos = pos;
        this.drawLine = drawLine;
    }
}

interface ClientBoard {
    dimensions: Pos;
    background?: {
        image: string;
        width: number;
    };
    pieces: { [index: string]: Piece };
    lines: { [index: string]: Line };
    fill: { [index: string]: SquareFill };
}

// TODO: figure out common.ts
class Pos {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public static fromString(posStr: string): Pos {
        const pos = posStr.split(",");
        return new Pos(parseFloat(pos[0]), parseFloat(pos[1]));
    }

    public toString(): string {
        return `${this.x},${this.y}`;
    }
}

function toPosPair(pos1: Pos, pos2: Pos): string {
    return pos1.x + "_" + pos1.y + "__" + pos2.x + "_" + pos2.y;
}

interface SquareFill {
    color: string;
    pattern: string;
}

enum FillPatterns {
    SOLID = "solid"
}

interface ServerBoard {
    dimensions: Pos;
    background?: {
        image: string;
        width: number;
    };
    pieces: {
        [index: string]: ServerPiece
    };
    lines: {
        [index: string]: ServerLine
    };
    fill: {
        [index: string]: SquareFill
    };
    pieceCount: number;
}

interface ServerPiece {
    id: string;
    name: string;
    icon: string;
    pos: Pos;
}

interface ServerLine {
    pos1: Pos;
    pos2: Pos;
    thickness: number;
    color: string;
}