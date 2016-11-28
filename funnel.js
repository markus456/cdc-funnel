var net = require("net")
var crypto = require("crypto")
var split2 = require("split2")
var express = require("express")
var config = require("config")
var app = express()

var client = config.get("source")
var server = config.get("listen")

function handleSocket(sock, target, res) {

    // Send the authentication
    const hash = crypto.createHash('sha1')
    hash.update(client.password)

    sock.write(new Buffer(client.user + ":").toString('hex') + hash.digest().toString('hex'));

    var state = 0

    sock.pipe(split2()).on('data', (obj) => {
        if (state == 0) {
            // Register for JSON events
            sock.write("REGISTER UUID=asdf, TYPE=JSON");
            state++
        } else if (state == 1) {
            // Request the data stream
            sock.write("REQUEST-DATA " + target);
            state++
        } else {
            // Send the objects
            res.write(obj + "\n")
        }
    })
}

app.get("/", (req, resp) => {
    try {
        if(req.query.tables) {
            tables = req.query.tables.split(',')

            resp.writeHead(200,
                           {
                               "Content-Type": "application/json",
                               'Transfer-Encoding': 'chunked',
                               'Connection': 'Transfer-Encoding'
                           })

            tables.forEach((d) => {
                handleSocket(net.createConnection(client.port, client.host), d, resp)
            })
        }

    } catch (ex) {
        console.log(ex)
    }
})

app.listen(server.port, server.host, () => {
    console.log("Listening on " + server.host + ":" + server.port)
})

process.on('uncaughtException', (ex) => {
    console.log(ex);
});
