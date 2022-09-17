export class Pos {
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

export function toPosPair(pos1: Pos, pos2: Pos): string {
    return pos1.x + "_" + pos1.y + "__" + pos2.x + "_" + pos2.y;
}

export interface SquareFill {
    color: string;
    pattern: string;
}

export enum FillPatterns {
    SOLID = "solid"
}

export interface ServerBoard {
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

export interface ServerPiece {
    id: string;
    name: string;
    icon: string;
    pos: Pos;
}

export interface ServerLine {
    pos1: Pos;
    pos2: Pos;
    thickness: number;
    color: string;
}