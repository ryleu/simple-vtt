# simple-vtt
A simple, fast, system-less Virtual Table Top.

If you want to use it **right now**, you can use this handy button here to
launch it on Heroku:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ryleu/simple-vtt/tree/main)

A free demo (that may be laggy and should not be used for actual games) can be
found at <https://simple-vtt.herokuapp.com>.

**Table of Contents**
 - [Configuration](#configuration)
 - [Running](#running)
 - [Protocol](#protocol)
 - [Roadmap](#roadmap)
 - [Attribution](#attribution)

## Configuration
`config.json` looks like this:

```json
{
  "auth": {
    "key": "/path/to/https/privkey.pem",
    "cert": "/path/to/https/fullchain.pem"
  }
}
```

The port must be set through the `$PORT` environment variable.

## Running

Install Node.JS and NPM and then run `npm i` in the project root.

Use `npm run start_s` to start the server with HTTPS. Use
`rpm run start_i` to run an HTTP version. Running `npm start` will
launch the Heroku version of simple-vtt.

## Protocol
S-VTT uses a straightforward spec for websocket communication:

|      Action       |                   Request                    |                         Response                          | Description                                                                                                                                     |
|:-----------------:|:--------------------------------------------:|:---------------------------------------------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------|
|    Add a piece    |          `&S;<name>;<x>,<y>;<icon>`          |              `&S;<id>;<name>;<x>,<y>;<icon>`              | `id`: Unique identifier <br /> `name`: Base 64 encoded piece name <br /> `x,y`: Integer coordinate pair <br /> `icon`: Base 64 encoded icon URL |
|   Move a piece    |              `&M;<id>;<x>,<y>`               |                     `&M;<id>;<x>,<y>`                     | `id`: Unique identifier <br /> `x,y`: Integer coordinate pair                                                                                   |
|  Delete a piece   |                  `&D;<id>`                   |                         `&D;<id>`                         | `id`: Unique identifier                                                                                                                         |
|   Create a line   | `&L;<x1>,<y1>;<x2>,<y2>;<thickness>;<color>` | `&L;<x1>_<y1>__<x2>_<y2>;<x1>,<y1>;<x2>,<y2>;<thickness>` | `x1,y1`: Initial coordinate pair <br /> `x2,y2`: End coordinate pair <br /> `thickness`: Thickness of the line <br /> Hex color code            |
|   Remove a line   |          `&R;<x1>_<y1>__<x2>_<y2>`           |                 `&R;<x1>_<y1>__<x2>_<y2>`                 | `x1,y1`: Initial integer coordinate pair <br /> `x2,y2`: End integer coordinate pair                                                            |
|    Fill a tile    |         `&F;<x>,<y>;<color>;<style>`         |               `&F;<x>,<y>;<color>;<style>`                | `x,y`: Tile coordinate pair <br /> `color:` Hex color code <br /> `style:` Style of fill. Options: solid. Default: solid.                       |
| Re-size the board |                 `&B;<x>,<y>`                 |                       `&B;<x>,<y>`                        | `x,y` Integer length / width pair                                                                                                               |
|  Clear the board  |                     `&C`                     |                        `&B;30,15`                         | None                                                                                                                                            |
|    Join a room    |                `&A;<invite>`                 |                       `&A;<invite>`                       | Invite code                                                                                                                                     |

There are also an HTTP API at `/api/`:

|         Endpoint          | Description                                                                |
|:-------------------------:|:---------------------------------------------------------------------------|
| `/api/board/?id=<invite>` | GET to get the board for <invite> or PUT to load in a new one for <invite> |
|        `/api/new/`        | POST to generate a new blank board, responds with `{"invite": "<invite>"}` |

Any other path is sourced from `site/`.

## Roadmap

 - [x] Basic HTTPS communication
 - [x] Rendering
 - [x] Lines
 - [x] Pieces
 - [x] Saving and loading
 - [x] Heroku deploy support
 - [x] Tile fills
 - [x] Chromium / Webkit support
 - [ ] Default pieces
 - [ ] Custom saved pieces
 - [ ] ~~Game master~~ This will never be implemented in v1.x.x.

## Attribution
Icons are from the [Papirus Icon Theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
