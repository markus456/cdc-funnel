var net = require("net")
var crypto = require("crypto")
var split2 = require("split2")
var express = require("express")
var app = express()

var my_port = 4001
var my_host = "127.0.0.1"
var my_user = "markusjm"
var my_password = "markusjm"

function handleSocket(sock, target, res) {

    // Send the authentication
    const hash = crypto.createHash('sha1')
    hash.update(my_password)

    sock.write(new Buffer(my_user + ":").toString('hex') + hash.digest().toString('hex'));

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
                handleSocket(net.createConnection(my_port, my_host), d, resp)
            })
        }

    } catch (ex) {
        console.log(ex)
    }
})

app.listen(8080, () => {
    console.log("Listening on 8080")
})
