// cdc-funnel - CDC Funneling Service
// Copyright (C) 2016  Markus Mäkelä
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

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

// Data formatter for plain newline delimited JSON
function writeJSON(dest, obj) {
    dest.write(JSON.stringify(obj) + "\n")
}

// Data formatter for Server-Sent Events
function writeSSE(dest, obj) {
    dest.write("data: " + JSON.stringify(obj) + "\n\n")
}

// Stream the JSON events to the client
function cdcStream(obj) {
    obj.socket.pipe(split2()).on('data', (data) => {
        var tmp = JSON.parse(data)
        tmp.table = obj.target

        if (server.format == "sse") {
            writeSSE(obj.output, tmp)
        } else {
            writeJSON(obj.output, tmp)
        }
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

            if (server.format == "sse") {
                // Send SSE events
                contentType = "text/event-stream"
            } else {
                // Send plain JSON, client needs to parse it
                contentType = "application/json"
            }

            resp.set({ "Access-Control-Allow-Origin": "*",
                       "Content-Type": contentType })


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
