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
let board: {
    dimensions: Pos,
    pieces: { [index: string]: Piece },
    lines: { [index: string]: Line },
    fill: { [index: string]: SquareFill }
} = {
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
    ADD_PIECE_A = "addA", // add piece, not complete
    ADD_PIECE_B = "addB", // add piece, not completeDimensionsDimensions
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

// create the websocket. this is called whenever the websocket is destroyed or disconnected
function newWebSocket() {
    // use the URL we determined earlier
    let sock = new WebSocket(websocketURL);

    // when the socket is opened
    sock.onopen = () => {
        // try to connect to a board
        sock.send(`&A;${boardId}`);

        // make the main menu visible
        document.getElementById("main-menu")!!.className = "menu";
        // remove the loading cursor
        document.getElementById("body")!!.style.cursor = "default";
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
        document.getElementById("menu-create-piece")!!.addEventListener("click", () => {
            state = States.ADD_PIECE_A;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("add-piece-menu")!!.className = "menu";
        });

        // add piece cancel
        document.getElementById("piece-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("add-piece-menu")!!.className = "hidden-menu";

            // clear our piece menu when closing it
            (document.getElementById("piece-menu-name-input") as HTMLInputElement)!!.value = "";
            (document.getElementById("piece-menu-icon-input") as HTMLInputElement)!!.value = "";
            let img = document.getElementById("piece-menu-preview")!! as HTMLImageElement;
            img.title = "";
            img.src = "";
        });

        // add piece preview
        document.getElementById("piece-menu-load")!!.addEventListener("click", () => {
            state = States.ADD_PIECE_B;
            stateData = new AddPieceStateData(
                (document.getElementById("piece-menu-name-input")!! as HTMLInputElement).value,
                (document.getElementById("piece-menu-icon-input")!! as HTMLInputElement).value
            )

            let img = document.getElementById("piece-menu-preview")!! as HTMLImageElement;
            img.title = stateData.name;
            img.src = stateData.icon;
        });


        // // add line button
        document.getElementById("menu-create-line")!!.addEventListener("click", () => {
            state = States.LINE_DRAW_A;
            stateData = null;
            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("add-line-menu")!!.className = "menu";
        });

        // add line cancel
        document.getElementById("line-menu-close")!!.addEventListener("click", () => {
            state = States.NEUTRAL;
            stateData = null;
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("add-line-menu")!!.className = "hidden-menu";
        });


        // // add fill button
        document.getElementById("menu-fill")!!.addEventListener("click", () => {
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
        document.getElementById("menu-delete")!!.addEventListener("click", () => {
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
        document.getElementById("menu-config")!!.addEventListener("click", () => {
            // populate the dimensions and scale input fields
            (document.getElementById("config-menu-scale-input")!! as HTMLInputElement).value = getScale().toString();
            (document.getElementById("config-menu-dims-input-x")!! as HTMLInputElement).value = board.dimensions.x.toString();
            (document.getElementById("config-menu-dims-input-y")!! as HTMLInputElement).value = board.dimensions.y.toString();

            document.getElementById("main-menu")!!.className = "hidden-menu";
            document.getElementById("config-menu")!!.className = "menu";
        });

        // config cancel
        document.getElementById("config-menu-close")!!.addEventListener("click", () => {
            document.getElementById("main-menu")!!.className = "menu";
            document.getElementById("config-menu")!!.className = "hidden-menu";
        });

        function rescale() {
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
        }

        // config scale
        document.getElementById("config-menu-rescale")!!.addEventListener("click", rescale);
        (document.getElementById("config-menu-scale-input")!! as HTMLInputElement).addEventListener("change", rescale);

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
                    data[3].toString("base64") // base64 icon url
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
                    square.style.backgroundColor = "var(--main-color)";
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
        }
    };

    return sock;
}

ws = newWebSocket();

fetch(`/api/board/?id=${boardId}`)
    .then(response => {
        if (response.ok) {
            response.json().then(json => {
                board.dimensions = json.dimensions;
                board.fill = json.fill;
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
        row.style.height = "calc(var(--scale) * 1px)";

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
            square.style.width = "calc(var(--scale) * 1px)";
            square.style.height = "calc(var(--scale) * 1px)";
            square.style.left = `calc(var(--scale) * ${j}px)`;

            let button = document.createElement("button");
            button.className = "square-button";
            button.id = `square-button-${i}-${j}`;
            button.style.width = "calc(var(--scale) * 1px)";
            button.style.height = "calc(var(--scale) * 1px)";
            if ((i + j) % 2 === 0) {
                // I'm using an overlay here so that the color will change with any
                // background color
                button.style.backgroundColor = "var(--main-accent-difference)";
            }

            button.addEventListener("click", event => {
                let targetId = button.id.split("-");

                clickEvent(new Pos(
                    parseInt(targetId[3]) + subScale * Math.round(event.offsetX / (getScale() * subScale)),
                    parseInt(targetId[2]) + subScale * Math.round(event.offsetY / (getScale() * subScale))
                ));
            });

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
            let img = (document.getElementById("piece-menu-preview")!! as HTMLImageElement);
            img.title = "";
            img.src = "";
            ws.send(
                `&S;${btoa(stateData.name)};` +
                `${piecePos.x},${piecePos.y};` +
                `${btoa(stateData.icon)}`
            );
            stateData = null;
            state = States.NEUTRAL;
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


// HELPER FUNCTIONS //

// get the element for the board
function getBoardElement() {
    return document.getElementById("board")!!;
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

        let polPos = cartesianToPolar(pos2.x - pos1.x, pos2.y - pos1.y);

        this.length = polPos.distance;
        this.angle = polPos.radians;

        this.pos = pos1;
        this.pos2 = pos2;
        this.thickness = thickness;
        this.color = color;

        this.element = document.createElement("button");

        this.element.addEventListener("click", event => {
            // offsetX is needed here because it works the same way in Firefox, Chromium, and WebKit
            const relPos = polarToCartesian(event.offsetX, this.angle);

            // Remember: the click is offset by the subscale
            const pos = new Pos(
                this.pos.x + subScale * (Math.round(relPos.x / (getScale() * subScale)) - 1),
                this.pos.y + subScale * (Math.round(relPos.y / (getScale() * subScale)) - 1)
            );

            switch (state) {
                case States.DELETE:
                    stateData = this;
                    ws.send(`&R;${this.id}`);
                    break;
                default:
                    clickEvent(pos);
            }
        });

        this.element.className = "line";
        this.element.id = `line-${this.id}`;

        this.element.style.width = `calc(var(--scale) * ${this.length}px)`;
        this.element.style.height = `calc(var(--scale) * ${thickness}px / 15)`;

        this.element.style.backgroundColor = color;
        this.element.style.borderColor = color;
        // transform because the actual value is offset by the subscale
        this.element.style.transform =
            `translateY(calc(-${thickness}px * var(--scale) / 30 - var(--scale) * ${subScale}px))` +
            `translateX(calc(var(--scale) * -${subScale}px))` +
            `rotate(${this.angle}rad)`;

        this.element.style.left = `calc(${this.pos.x}px * var(--scale))`;
        this.element.style.top = `calc(${this.pos.y}px * var(--scale))`;

        getBoardElement().appendChild(this.element);
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

        this.element.addEventListener('click', event => {
            let pos = new Pos(
                (this.pos.x - 1) + subScale * Math.round(event.offsetX / (getScale() * subScale)),
                (this.pos.y - 1) + subScale * Math.round(event.offsetY / (getScale() * subScale))
            );

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
                    clickEvent(pos);
            }
        });

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