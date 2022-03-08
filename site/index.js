const ws = new WebSocket('ws://127.0.0.1:8081');

const actionRe = /&[SMDLRB];/

let board = {
  "dimensions": [0, 0],
  "pieces": {},
  "lines": {}
}

function getPiece(id) {

  for (var i = 0; i < Object.keys(board.pieces).length; i++) {
    if (board.pieces[i].id == id) {
      return board.pieces[i];
    }
  }
}

let boardElement = {
  get now() {
    return document.getElementById("board");
  }
};

var elementGrid = []

var wsReady = false;
var jsonReady = false;

fetch("/api/board").then((response) => {
  console.log(response);
  return response.json();
}).then((json) => {
  board.dimensions = json.dimensions;
  renderBoard(json.dimensions[0], json.dimensions[1]);

  var piece;
  Object.keys(json.pieces).forEach((pieceId, i) => {
    piece = json.pieces[pieceId];
    board.pieces[i] = new Piece(pieceId, piece.name, piece.pos, piece.icon);
  });

  var line;
  Object.keys(json.lines).forEach((lineId, i) => {
    line = json.lines[lineId];
    board.lines[lineId] = new Line(line.pos1, line.pos2, line.thickness, line.color);
  });

  jsonReady = true;

  if (wsReady) {
    document.querySelector('#send').disabled = false;
  }
});

ws.onopen = function() {
  wsReady = true;
  if (jsonReady) {
    document.querySelector('#send').disabled = false;
  }

  document.querySelector('#send').addEventListener('click', function() {
    ws.send(document.querySelector('#message').value);
    document.querySelector('#message').value = "";
  });
};

ws.onmessage = function(msg) {
  if (!msg.data.match(actionRe)) {
    return;
  }

  var rawData = msg.data.split(";");
  var action = rawData[0].substring(1);
  var data = rawData.slice(1, rawData.length);

  switch (action) {
    case "S":
      addSprite(data);
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
  }
};

function parsePos(posStr) {
  var pos = posStr.split(",");
  return [pos[0]-0, pos[1]-0];
}

function toPosPair(pos1, pos2) {
  return pos1[0]+"_"+pos1[1]+"__"+pos2[0]+"_"+pos2[1];
}

function addSprite(data) {
  var id = data[0]-0;
  var name = data[1];
  var pos = parsePos(data[2]);
  var icon = atob(data[3]);

  board.pieces[id] = new Piece(id, name, pos, icon);
}

function moveSprite(data) {
  var id = data[0]-0;
  var pos = parsePos(data[1]);
  getPiece(id).pos = pos;
}

function deleteSprite(data) {
  var id = data[0]-0;
  try {
    getPiece(id).remove();
  } catch (e) {
    console.error(e);
  }
  for (var i = 0; i < board.pieces.length; i++) {
    if (board.pieces[i].id == id) {
      delete board.pieces[i];
      return;
    }
  }
}

function createLine(data) {
  var pos1 = parsePos(data[0]);
  var pos2 = parsePos(data[1]);
  var thickness = data[2]-0;
  var color = data[3];

  if (!color) {
    color = "000000"
  }

  var line = new Line(pos1, pos2, thickness, color);

  board.lines[line.id] = line
}

function deleteLine(data) {
  var posPair = data[0]+";"+data[1];
  board.lines[posPair].remove();
  delete board.lines[posPair];
}

function setDimensions(data) {
  window.location.reload();
}

// RENDERING //

var scale = 100;

function setScale(newScale) {
  scale = newScale;
  renderBoard(board.dimensions[0], board.dimensions[1]);
}

function renderBoard(x, y) {
  for (var i = elementGrid.length - 1; i > -1; i--) {
    for (var j = elementGrid[i].children.length - 1; j > -1; j--) {
      elementGrid[i].children[j].remove();
      delete elementGrid[i][j];
    }
    elementGrid[i].remove();
    delete elementGrid[i];
  }

  var tempGrid = [];

  for (var i = 0; i < x; i++) {
    var row = document.createElement('div');
    row.className = 'row';
    row.id = "row-" + i;
    row.style.width = (scale * x) + "px";
    row.style.height = scale + "px";

    for (var j = 0; j < y; j++) {
      var square = document.createElement('div');
      var button = document.createElement("button");
      button.className = "square-button";
      button.id = "square-button-" + i + "-" + j;
      button.style.width = scale + "px";
      button.style.height = scale + "px";
      button.style.position = "absolute";

      button.addEventListener("click", event => {
        var selectedPieces = document.getElementsByClassName("selected-piece-button");

        // safety
        if (selectedPieces.length > 1) {
          while (selectedPieces.length > 0) {
            selectedPieces[0].className = "piece-button";
          }
        }

        if (selectedPieces.length !== 1) return;

        var piece = selectedPieces[0];

        var id = piece.id.split("-")[2];

        var targetId = event.target.id.split("-");

        ws.send(`&M;${id};${targetId[3]-0 + 1},${targetId[2]-0 + 1}`);

        piece.className = "piece-button";
      });
      square.appendChild(button);

      square.className = 'square';
      square.id = "square-" + j;
      square.style.backgroundColor = (i + j) % 2 === 0 ? '#ccc' : '#aaa';
      square.style.position = "absolute";
      square.style.width = scale + "px";
      square.style.height = scale + "px";
      square.style.left = (scale * j) + "px";
      row.appendChild(square);
    }
    boardElement.now.appendChild(row);
    tempGrid.push(row);
  }

  elementGrid = tempGrid;
 }

class Piece {
  constructor(id, name, pos, icon) {
    this.id = id;
    this.name = name;
    this.icon = icon;

    // create the element on the page
    this.element = document.createElement("div");
    this.image = document.createElement("img");
    this.button = document.createElement("button");

    this.button.addEventListener('click', event => {
      if (this.button.className == "selected-piece-button") {
        this.button.className = "piece-button";
      } else {
        var selectedPieces = document.getElementsByClassName("selected-piece-button");
        while (selectedPieces.length > 0) {
          selectedPieces[0].className = "piece-button";
        }
        this.button.className = "selected-piece-button";
      }
    });

    this.image.className = "piece-image";
    this.image.id = "piece-image-" + id;
    this.image.style.width = scale + "px";
    this.image.style.height = scale + "px";
    this.image.src = icon;
    this.image.style.position = "absolute";
    this.element.appendChild(this.image);

    this.button.className = "piece-button";
    this.button.id = "piece-button-" + id;
    this.button.style.width = scale + "px";
    this.button.style.height = scale + "px";
    this.button.style.position = "absolute";
    this.element.appendChild(this.button);

    this.element.className = "piece";
    this.element.id = "piece-" + id;
    this.element.title = name;

    this.element.style.width = scale + "px";
    this.element.style.height = scale + "px";
    this.element.style.position = "absolute";

    this.pos = pos;
  }

  set pos(newPos) {
    this._pos = newPos;
    this.remove();
    this.element.style.left = (newPos[0] - 1) * scale + "px";
    elementGrid[newPos[1] - 1].appendChild(this.element);
  }

  get pos() {
    return this._pos;
  }

  remove() {
    this.element.remove();
  }
}

function rectToPol(pos) {
  return [
    Math.sqrt(Math.pow(pos[0], 2) + Math.pow(pos[1], 2)),
    Math.atan(pos[0] / pos[1])
  ];
}

function polToRect(pos) {
  return [
    Math.cos(pos[1]) * pos[0],
    Math.sin(pos[1]) * pos[0]
  ];
}

function transform(pos1, pos2) {

}

class Line {
  constructor(pos1, pos2, thickness, color) {
    if (pos1[0] < pos2[0]) {
      this.id = toPosPair(pos1, pos2);
    } else if (pos2[0] < pos1[0]) {
      this.id = toPosPair(pos2, pos1);
    } else if (pos1[1] < pos2[1]) {
      this.id = toPosPair(pos1, pos2);
    } else if (pos2[1] < pos1[1]) {
      this.id = toPosPair(pos2, pos1);Math
    } else {
      throw Exception();
    }

    var relPolPos = rectToPol([pos2[0] - pos1[0], pos2[1] - pos1[1]]);

    var length = relPolPos[0];
    var angle = relPolPos[1];

    this.pos = pos1;

    this.element = document.createElement("div");

    this.element.className = "line";
    this.element.id = "line-" + this.id;

    this.element.style.width = length * scale + "px";
    this.element.style.height = thickness * scale / 16 + "px";
    this.element.style.position = "absolute";

    this.element.style.backgroundColor = "#" + color;
    this.element.style.transform = "rotate(" + angle + "rad)";

    this.element.style.left = ((this.pos[0] - 1) * scale) + "px";
    this.element.style.top = (this.pos[1] % board.dimensions[1]) * scale + "px";
    elementGrid[Math.floor(this.pos[1]) - 1].appendChild(this.element);
  }

  remove() {
    this.element.remove();
  }
}
