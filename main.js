
const { assert } = require('console');
const net = require('net')



class HTTPError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "HTTPError";
    }
}


function soInit(socket) {

    const conn = {
        socket: socket,
        reader: null,

    }

    socket.on('data', (data) => {

        console.assert(conn.reader)

        conn.socket.pause();

        conn.reader.resolve(data);

        conn.reader = null;

    })

    return conn;


}

function onRead(conn) {

    console.assert(!conn.reader)

    return new Promise((resolve, reject) => {

        conn.reader = {
            resolve: resolve,
            reject: reject

        }

        conn.socket.resume();
    })
}


function onWrite(conn, data) {

    console.assert(data.length > 0);

    return new Promise((resolve, reject) => {

        if (conn.err) {
            reject(conn.err)
            console.log(err);
            return;
        }

        conn.socket.write(data, err => {
            if (err) {
                reject(conn.err)
            }
            else {
                resolve();
            }
        })

    })
}

// buff = {data : data , length : length}
function onPush(data, buff) {

    const newlength = buff.length + data.length

    if (buff.data.length < newlength) {

        let cap = Math.max(buff.data.length, 32)

        while (cap < newlength) {
            cap *= 2
        }

        const grown = Buffer.alloc(cap)

        buff.data.copy(grown, 0, 0)
        buff.data = grown
    }

    data.copy(buff.data, buff.length, 0)
    buff.length = newlength

}

function bufPop(buff, length) {
    buff.data.copyWithin(0, length, buff.length);
    buff.length -= length

}



// This function takes a stream of bytes and split the header from the http object

function cutMessage(buff) {

    const kMaxheaderlength = 1024 * 8;

    const idx = buff.data.subarray(0, buff.length).indexOf('\r\n\r\n');

    if (idx < 0) {

        if (buff.length > kMaxheaderlength) {

            throw HTTPError(413, 'header is too large')
        }

        return null;

    }

    const message = ParseHTTPReq(buff.data.subarray(0, idx + 4))

    // buff.data.copy(buff.data, 0, idx + 4, buff.length);
    // buff.length -= (idx + 4); another way to pop data out of the buffer



    bufPop(buff, idx + 4)

    return message;
}

// The splitLines , ParseReqLines and the validate headers are all utilty functions
//  That helps to parse the header comes inside ParseHTTPReq


function splitLines(data) {

    let idx = 0
    const lines = []

    while (true) {

        const line_index = data.indexOf('\r\n', idx);

        if (line_index === -1) {
            break
        }

        const line = data.subarray(idx, line_index);

        idx = line_index + 2

        if (line.length === 0) {
            lines.push('')
            break;
        }

        lines.push(line.toString())

    }

    return lines

}



function ParseReqLine(header_line) {

    return header_line.split(' ');

}

function validate_header(headers) {

    const h = headers.indexOf(':');

    if (h === -1) {
        return false
    }

    return true

}


function ParseHTTPReq(data) {

    const header_lines = splitLines(data);

    const [method, uri, version] = ParseReqLine(header_lines[0]);

    const headers = []

    for (let i = 1; i < header_lines.length - 1; i++) {

        const h = Buffer.from(header_lines[i])

        if (!validate_header(h)) {

            throw new HTTPError(400, 'bad field');
        }

        headers.push(h)

    }

    // header ends with a empty Line:
    console.assert(header_lines[header_lines.length - 1].length === 0);

    return {
        method: method,
        uri: uri,
        version: version,
        headers: headers,
    }

}

// function fieldGet(headers, fieldName) {

//     const fieldBuffer = Buffer.from(fieldName);

//     for (let i = 0; i < headers.length; i++) {

//         idx = headers[i].indexOf(':')

//         if (idx != -1) {

//             if (headers[i].subarray(0, idx).equals(fieldBuffer)) {
//                 return headers[i].subarray(idx + 1).toString().trim();
//             }

//         }
//     }

// }


function fieldGet(headers, key) {
    key = key.toLowerCase();
    for (const h of headers) {
        const pos = h.indexOf(':');
        if (pos < 0) {
            continue;
        }
        const name = h.subarray(0, pos).toString('latin1').toLowerCase();
        if (name === key) {
            const val = h.subarray(pos + 1);
            // trim leading/trailing whitespace
            let start = 0;
            while (start < val.length && (val[start] === 0x20 || val[start] === 0x09)) {
                start++;
            }
            let end = val.length;
            while (end > start && (val[end - 1] === 0x20 || val[end - 1] === 0x09)) {
                end--;
            }
            return val.subarray(start, end);
        }
    }
    return null;
}


function readerFromConnLength(conn, buff, bodyLen) {

    return {

        length: bodyLen,

        read: async function () {

            if (bodyLen === 0) {
                return Buffer.from('');
            }

            if (buff.length === 0) {

                const data = await onRead(conn)
                onPush(data, buff)
                if (data.length === 0) {

                    throw new Error('Unexpected EOF from HTTP body')
                }

            }

            const consume = Math.min(buff.length, bodyLen);
            bodyLen -= consume;
            const data = Buffer.from(buff.data.subarray(0, consume));
            bufPop(buff, consume);
            return data;

        }

    }
}


async function handleReq(req, body) {

    let resp;
    switch (req.uri.toString('latin1')) {

        case '/echo':
            resp = body

            break;
        default:
            break;
    }

    return {
        code: 200,
        headers: [Buffer.from('Server: my_first_http_server')],
        body: resp,
    }

}

function readerFromReq(conn, buff, req) {

    let bodyLen = -1;

    const contentLen = fieldGet(req.headers, "Content-Length")

    if (contentLen) {
        const bodyLenStr = contentLen.toString('latin1');

        if (isNaN(bodyLenStr)) {

            throw new HTTPError(400, 'bad content length')

        }

        bodyLen = Number(bodyLenStr)

    }

    const bodyAllowed = !(req.method == 'GET' || req.method == 'HEAD');
    const chunked = fieldGet(req.headers, 'Transfer-Encoding')?.equals(Buffer.from('chunked')) || false;


    if (!(bodyAllowed) && (bodyLen > 0 || chunked)) {
        throw new HTTPError(400, 'HTTP body not allowed.')
    }
    if (!(bodyAllowed)) {
        bodyLen = 0;
    }

    if (bodyLen >= 0) {
        return readerFromConnLength(conn, buff, bodyLen);
    }

    else if (chunked) {
        throw new HTTPError(501, 'TODO');
    }

    else {
        throw new HTTPError(501, 'TODO');

    }

}


async function writeHTTPResp(conn, resp) {
    if (resp.body.length < 0) {
        throw new Error('TODO: chunked encoding');
    }

    console.assert(!fieldGet(resp.headers, 'Content-Length'));

    resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));

    // await onWrite(conn, Buffer.from(resp));
    // write the body

    const head = Buffer.from(
        `HTTP/1.1 ${resp.code} OK\r\n` +
        resp.headers.map(h => h.toString('latin1') + '\r\n').join('') +
        '\r\n'
    );
    await onWrite(conn, head);
    while (true) {
        const data = await resp.body.read();
        if (data.length === 0) {
            break;
        }
        await onWrite(conn, Buffer.from(data));
    }
}

async function main(socket) {

    const conn = soInit(socket);


    const buff = {
        data: Buffer.alloc(0),
        length: 0
    }

    while (true) {

        let msg = cutMessage(buff);

        if (msg) {

            console.log(JSON.stringify(msg))

        }
        else {

            const data = await onRead(conn)
            onPush(data, buff);

            if (data.length === 0 && buff.length === 0) {
                return
            }

            if (data.length === 0) {
                throw new HTTPError(400, 'Unexpected EOF')
            }

            continue;
        }


        const reqBody = readerFromReq(conn, buff, msg)
        const res = await handleReq(msg, reqBody);
        console.log(res)
        await writeHTTPResp(conn, res)
        if (msg.version === '1.0') {
            return;
        }

    }
}


const server = net.createServer(main)


server.listen(3000, () => {
    console.log("The server is Listiening on port 3000")
})