var net = require("net")
var crypto = require("crypto")
var split2 = require("split2")
var express = require("express")
var config = require("config")
var app = express()

var client = config.get("source")
var server = config.get("listen")

function handleSocket(sock, target, gtid, res) {

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

            if (gtid.domain > 0 && gtid.server_id > 0 && gtid.sequence > 0) {
                sock.write("REQUEST-DATA " + target + " " + gtid.domain + "-" + gtid.server_id + "-" + gtid.sequence);
            } else {
                sock.write("REQUEST-DATA " + target);
            }

            state++
        } else if (client.skip_headers && state == 2) {
            // Skip the Avro Schema row
            state++
        } else {
            // Send the objects
            var tmp = JSON.parse(obj)
            tmp.table = target
            res.write(JSON.stringify(tmp) + "\n")
        }

    })
}

app.get("/", (req, resp) => {
    try {
        if(req.query.tables) {
            tables = req.query.tables.split(',')

            gtid = {
                sequence: 0,
                server_id: 0,
                domain: 0
            }

            if (req.query.gtid) {
                req_gtid = req.query.gtid.split('-')
                gtid.domain = req_gtid[0]
                gtid.server_id = req_gtid[1]
                gtid.sequence = req_gtid[2]
            }

            resp.writeHead(200,
                           {
                               "Content-Type": "application/json",
                               'Transfer-Encoding': 'chunked',
                               'Connection': 'Transfer-Encoding'
                           })

            tables.forEach((t) => {
                handleSocket(net.createConnection(client.port, client.host), t, gtid, resp)
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
