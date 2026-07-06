
const { assert } = require('console');
const net = require('net')



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


function cutMessage(buff) {

    const kMaxheaderlength = 1024 * 8;

    const idx = buff.data.subarray(0, buff.length).indexOf('\r\n\r\n');

    if (idx < 0) {

        if (buff.length > kMaxheaderlength) {

            throw HTTPError(413, 'header is too large')
        }

        return null;

    }

    const message = buff.data.subarray(0, idx + 4)

    // buff.data.copy(buff.data, 0, idx + 4, buff.length);
    // buff.length -= (idx + 4); another way to pop data out of the buffer

    bufPop(buff, idx + 4)

    ParseHTTPReq(buff.data.subarray(0, idx + 4))

    return message;
}

function ParseHTTPReq(buff_header) {

    const header_lines = buff_header.split('\r\n');

    console.log(header_lines.toString())

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

            console.log(msg)

        }
        else {

            const data = await onRead(conn)
            onPush(data, buff);

            if (data.length == 0 && buff.length == 0) {
                return
            }

            if (data.length == 0) {
                throw new HTTPError(400, 'Unexpected EOF')
            }

            continue;

        }


    }
}


const server = net.createServer(main)


server.listen(3000, () => {
    console.log("The server is Listiening on port 3000")
})