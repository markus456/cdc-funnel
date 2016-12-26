var net = require("net")
var crypto = require("crypto")
var split2 = require("split2")
var express = require("express")
var config = require("config")
var app = express()

var client = config.get("source")
var server = config.get("listen")

// Register for JSON events
function cdcRegister(obj) {
    return new Promise((resolve, reject) => {
        obj.socket.write("REGISTER UUID=" + client.uuid + ", TYPE=JSON")
        obj.socket.pipe(split2()).once('data', () => {
            return resolve(obj)
        })
    })
}

// Request the data stream
//
// If a GTID is defined in the client request, only events starting from that
// GTID are requested. If no GTID is defined, all events are requested.
function cdcRequest(obj) {
    return new Promise((resolve, reject) => {

        if (obj.gtid.sequence > 0) {
            obj.socket.write("REQUEST-DATA " + obj.target + " " + obj.gtid.domain + "-" + obj.gtid.server_id + "-" + obj.gtid.sequence);
        } else {
            obj.socket.write("REQUEST-DATA " + obj.target);
        }

        if (client.skip_headers) {
            obj.socket.pipe(split2()).once('data', () => {
                resolve(obj)
            })
        } else {
            resolve(obj)
        }
    })
}

// Stream the JSON events to the client
function cdcStream(obj) {
    obj.socket.pipe(split2()).on('data', (data) => {
        var tmp = JSON.parse(data)
        tmp.table = obj.target
        obj.output.write(JSON.stringify(tmp) + "\n")
    })
}

// Create a new connection and authenticate
function cdcConnect(target, gtid, res) {

    return new Promise((resolve, reject) => {
        var sock = net.createConnection(client.port, client.host)
        sock.on('error', (err) => {
            reject(err)
        })

        // Send the authentication string
        const hash = crypto.createHash('sha1')
        hash.update(client.password)
        sock.write(new Buffer(client.user + ":").toString('hex') + hash.digest().toString('hex'));

        sock.pipe(split2()).once('data', (obj) => {
            resolve({
                socket: sock,
                target: target,
                gtid:   gtid,
                output: res
            })
        })
    })
}

// Extract the GTID from the request
function extractGTID(req) {
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

    return gtid
}

// Main entry point
//
// Expects at least one table in the `tables` query. If none are provided a 200
// OK response is sent to the client.
app.get("/", (req, resp) => {
    try {
        if(req.query.tables) {
            resp.set({ "Content-Type": "application/json" })

            var tables = req.query.tables.split(',')
            var gtid = extractGTID(req)

            tables.forEach((target) => {
                cdcConnect(target, gtid, resp)
                    .then(cdcRegister)
                    .then(cdcRequest)
                    .then(cdcStream)
                    .catch((e) => {
                        resp.status(503).end()
                    })
            })

        } else {
            resp.send()
        }

    } catch (ex) {
        console.log(ex)
    }
})

app.listen(server.port, server.host, () => {
    console.log("Listening on " + server.host + ":" + server.port)
})
