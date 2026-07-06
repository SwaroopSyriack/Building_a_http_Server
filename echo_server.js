const { assert } = require('console');
const net = require('net');

function soInit(socket) {
    const conn = {
        socket: socket,
        reader: null,

    }

    socket.on('data', (data) => {

        console.assert(conn.reader)

        conn.socket.pause()

        conn.reader.resolve(data)

        conn.reader = null;



    })

    return conn;
}


function onRead(conn) {

    console.assert(!conn.reader);

    return new Promise((resolve, reject) => {

        conn.reader = {
            resolve: resolve,
            reject: reject,
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

// The dynamic buffer would be : {'data' : data , 'length' : length}

function onPush(data, buff) {

    const newlength = buff.length + data.length

    if (buff.data.length < newlength) {

        let cap = Math.max(buff.data.length, 32)

        if (cap < newlength) {
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

function cutmsg(buff) {

    const idx = buff.data.subarray(0, buff.length).indexOf('\n');

    if (idx < 0) {
        return null;
    }

    const msg = Buffer.from(buff.data.subarray(0, idx + 1));
    bufPop(buff, idx + 1)

    return msg;


}



async function main(socket) {

    const conn = soInit(socket);

    const buff = {
        data: Buffer.alloc(0),
        length: 0,
    }




    while (true) {

        let msg = cutmsg(buff);

        if (!msg) {

            const data = await onRead(conn)

            if (data.length == 0) {
                console.log('end connection')
                break;
            }


            onPush(data, buff);

            continue;

        }

        if (msg.equals(Buffer.from('quit\n'))) {

            await onWrite(conn, Buffer.from('Bye\n'));
            console.log('quiting...')
            socket.destroy();
            return

        }
        else {

            const reply = Buffer.concat([Buffer.from('Echo: '), msg]);

            await onWrite(conn, reply);

        }



    }
}


const server = net.createServer(main)


server.listen(3000, () => {
    console.log("The server is Listiening on port 3000")
})