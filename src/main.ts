interface CacheFile {
    name: string;
    type: string;
}

class CacheDirectory implements CacheFile {
    name: string;
    type = "dir";
    files: Array<CacheDirectory | CacheFile>;

    constructor(name: string, files: Array<CacheDirectory | CacheFile>) {
        this.name = name;
        this.files = files;
    }
}

const Files = Object.freeze(cacheFiles("site", [
    { name: "index.html", type: "file" },
    { name: "index.js", type: "file" },
    { name: "style.css", type: "file" },
    { name: "favicon.ico", type: "file" },
    new CacheDirectory(
        "icons",
        [
            { name: "bucket.svg", type: "file" },
            { name: "cancel.svg", type: "file" },
            { name: "download.svg", type: "file" },
            { name: "gear.svg", type: "file" },
            { name: "pencil.svg", type: "file" },
            { name: "plus.svg", type: "file" },
            { name: "refresh.svg", type: "file" },
            { name: "tick.svg", type: "file" },
            { name: "trash.svg", type: "file" },
            { name: "undo.svg", type: "file" }
        ]
    ),
    new CacheDirectory(
        "board",
        [
            { name: "index.html", type: "file" },
            { name: "index.js", type: "file" },
            { name: "style.css", type: "file" }
        ]
    )
]));

/**
 * Caches specified files
 * @param root The root path of the files
 * @param fileList List of files and directories to cache
 * @returns An object of file path -> file text & content type
 */
async function cacheFiles(root: string, fileList: Array<CacheDirectory | CacheFile>): Promise<{ [path: string]: { content: string, type: string } }> {
    const outObj: { [path: string]: { content: string, type: string } } = {};

    for (let i = 0; i < fileList.length; i++) {
        let file = fileList[i];

        // different logic for directories and files
        if (!(file instanceof CacheDirectory)) {
            // for files, first get the file path from the root path and the file name
            let path = `${root}/${file.name}`;
            console.log("caching", path);

            let contentType = "text/plain";
            const extension = path.split(".").pop();

            // then determine the content type based on the extension
            // TODO: use something like MIME types
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

            // and finally, read the file and package it up with the content type, before appending that to the output
            outObj[path] = {
                content: await Bun.file(path).text(),
                type: contentType
            };
        } else {
            // for directories, we simply call the function again with a root set inside of the aforementioned directory
            const toAppend = await cacheFiles(`${root}/${file.name}`, file.files);
            const toAppendKeys = Object.keys(toAppend);

            // and then we append each of the packaged up files we get from recursion to the output
            toAppendKeys.forEach(toAppendKey => {
                outObj[toAppendKey] = toAppend[toAppendKey];
            });
        }
    }

    return outObj;
}

const server = Bun.serve({
    development: true,
    port: 8080,
    async fetch(request) {
        if (request.url.startsWith("/api")) {
            return new Response("501 not implemented", {
                status: 501
            });
        }
        return new Response("hi");
    },
});

console.log(`Listening on localhost: ${server.port}`);
