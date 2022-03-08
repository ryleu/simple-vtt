# simple-vtt
A simple, fast, system-less Virtual Table Top.

## Protocol

S-VTT uses a straightforward spec for websocket communication:

| Action | Request | Response | Description |
|:---:|:---:|:---:|:---|
| Add a sprite | `&S;<name>;<x>,<y>;<icon>` | `&S;<id>;<name>;<x>,<y>;<icon>` | `id`: Unique identifier <br /> `name`: Human-readable sprite name <br /> `x,y`: Integer coordinate pair <br /> `icon`: Base 64 encoded icon URL |
| Move a sprite | `&M;<id>;<x>,<y>` | `&M;<id>;<x>,<y>` | `id`: Unique identifier <br /> `x,y`: Integer coordinate pair |
| Delete a sprite | `&D;<id>` | `&D;<id>` | `id`: Unique identifier |
| Create a line | `&L;<x1>,<y1>;<x2>,<y2>;<thickness>` | `&L;<x1>,<y1>;<x2>,<y2>;<thickness>` | `x1,y1`: Initial integer coordinate pair <br /> `x2,y2`: End integer coordinate pair <br /> `thickness`: Thickness (px) of the line |
| Remove a line | `&R;<x1>,<y1>;<x2>,<y2>` | `&R;<x1>,<y1>;<x2>,<y2>` | `x1,y1`: Initial integer coordinate pair <br /> `x2,y2`: End integer coordinate pair |

There is an additional endpoint at `/api/board` to completely refresh board data (used when a client first joins).
