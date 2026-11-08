# Building an HTTP Server from Scratch

A minimal HTTP/1.1 server written in plain Node.js on top of raw TCP sockets — no `http` module, no Express, no dependencies. The goal of this project is to learn how HTTP actually works under the hood: reading bytes off a socket, buffering them, finding message boundaries, parsing headers, and writing a well-formed response.

The repository contains two stages of the project:

| File | What it is |
| --- | --- |
| `echo_server.js` | Step 1 — a line-based TCP echo server. Learns the core building blocks: promise-based socket I/O and a dynamic buffer. |
| `main.js` | Step 2 — an HTTP/1.1 server built on the same building blocks, with request parsing, `Content-Length` bodies and keep-alive. |

## Requirements

- [Node.js](https://nodejs.org/) (any recent version; tested on v22)
- No npm packages needed

## Getting started

```bash
git clone https://github.com/SwaroopSyriack/Building_a_http_Server.git
cd Building_a_http_Server
```

### Run the HTTP server

```bash
node main.js
# The server is Listiening on port 3000
```

In another terminal, send it a request:

```bash
curl -i -X POST --data 'hello world' http://localhost:3000/echo
```

```
HTTP/1.1 200 OK
Server: my_first_http_server
Content-Length: 11

hello world
```

The `/echo` endpoint sends the request body straight back to you.

### Run the echo server

```bash
node echo_server.js
```

Then connect with `netcat` (or `telnet`) and type lines:

```bash
nc localhost 3000
hi there
Echo: hi there
quit
Bye
```

Every line you send comes back with `Echo: ` added to the front. Sending `quit` closes the connection.

> Both servers listen on port **3000**, so run only one at a time.
