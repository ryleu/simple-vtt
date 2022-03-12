# simple-vtt
A simple, fast, system-less Virtual Table Top.

**Table of Contents**
 - [Configuration](#configuration)
 - [Running](#running)
 - [Protocol](#protocol)
 - [HTTP](#http)
 - [Attribution](#attribution)

## Configuration
`config.json` looks like this:

```json
{
	"port": 443,
	"auth": {
		"key": "/path/to/https/privkey.pem",
		"cert": "/path/to/https/fullchain.pem"
	}
}
```

## Running

Install Node.JS and NPM and then run `npm i` in the project root.

Use `sudo ./main.js` to start the server.

## Protocol
S-VTT uses a straightforward spec for websocket communication:

| Action | Request | Response | Description |
|:---:|:---:|:---:|:---|
| Add a piece | `&S;<name>;<x>,<y>;<icon>` | `&S;<id>;<name>;<x>,<y>;<icon>` | `id`: Unique identifier <br /> `name`: Base 64 encoded piece name <br /> `x,y`: Integer coordinate pair <br /> `icon`: Base 64 encoded icon URL |
| Move a piece | `&M;<id>;<x>,<y>` | `&M;<id>;<x>,<y>` | `id`: Unique identifier <br /> `x,y`: Integer coordinate pair |
| Delete a piece | `&D;<id>` | `&D;<id>` | `id`: Unique identifier |
| Create a line | `&L;<x1>,<y1>;<x2>,<y2>;<thickness>;<color>` | `&L;<x1>_<y1>__<x2>_<y2>;<x1>,<y1>;<x2>,<y2>;<thickness>` | `x1,y1`: Initial coordinate pair <br /> `x2,y2`: End coordinate pair <br /> `thickness`: Thickness of the line <br /> Hex color code |
| Remove a line | `&R;<x1>_<y1>__<x2>_<y2>` | `&R;<x1>_<y1>__<x2>_<y2>` | `x1,y1`: Initial integer coordinate pair <br /> `x2,y2`: End integer coordinate pair |
| Re-size the board | `&B;<x>,<y>` | `&B;<x>,<y>` | `x,y` Integer length / width pair |
| Clear the board | `&C` | `&B;30,15` | None |
| Join a room | `&A;<invite>` | `&A;<invite>` | Invite code |

There are also an HTTP API at `/api`:

| Endpoint | Description |
| `/api/board/?id=<invite>` | GET to get the board for <invite> or PUT to load in a new one for <invite> |
| `/api/new/` | POST to generate a new blank board, responds with `{"invite": "<invite>"}` |

## HTTP
You could change this on line 5:
```js
const https = require("https");
```
to this, if you want to use HTTP instead:
```js
const https = require("http");
```
Then, you have to remove TLS file references and change the websocket URL in `site/board/index.js` from `wss://` to `ws://`.


## Attribution
Icons are from the [Papirus Icon Theme](https://github.com/PapirusDevelopmentTeam/papirus-icon-theme).
