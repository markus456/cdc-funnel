# `cdc-funnel`

CDC stream combiner for [MariaDB MaxScale](https://github.com/mariadb-corporation/MaxScale).

The _cdc-funnel_ provides an easy way to combine multiple data streams into one
coherent newline delimited JSON stream. It is intended to be used with the
MaxScale CDC modules described in more detail [here](https://mariadb.com/kb/en/mariadb-enterprise/5961/).

The configuration file is found in `config/default.yml` and follows the following structure.

```
# Stream source configuration
source:
    user: markusjm      # Username for MaxScale CDC
    password: markusjm  # Password for MaxScale CDC
    host: 127.0.0.1     # MaxScale host
    port: 4001          # MaxScale port
    skip_headers: true  # Don't send Avro schema headers to the stream
    uuid: my_uuid       # A unique client identifier

# Service configuration
listen:
    port: 8080     # Port to listen for requests
    host: 0.0.0.0  # Where to bind
    format: sse    # Stream format, either `sse` (Server-Sent Events) or `json` (newline delimited JSON)
```

The service expects HTTP GET requests and accepts one parameter, `tables`, which
is comma-separate list of fully qualified table names (`database.table`). The
streams will be combined into one single stream by piping the content of the
stream to the client. The data will always be a newline delimited JSON stream.

```
[markusjm@localhost ~]$ curl localhost:8080/?tables=test.t1,test.t2
{"domain":0,"server_id":3000,"sequence":7429,"event_number":1,"timestamp":1480373261,"event_type":"insert","id":2,"data":"World","table":"test.t1"}
{"domain":0,"server_id":3000,"sequence":7430,"event_number":1,"timestamp":1480373262,"event_type":"insert","id":1,"data":"Hello","table":"test.t1"}
{"domain":0,"server_id":3000,"sequence":7431,"event_number":1,"timestamp":1480373262,"event_type":"insert","id":2,"data":"World","table":"test.t1"}
{"domain":0,"server_id":3000,"sequence":7432,"event_number":1,"timestamp":1480373263,"event_type":"insert","id":1,"data":"Hello","table":"test.t1"}
{"domain":0,"server_id":3000,"sequence":7423,"event_number":1,"timestamp":1480372781,"event_type":"insert","id":2,"data":"a","other_data":"message","table":"test.t2"}
{"domain":0,"server_id":3000,"sequence":7433,"event_number":1,"timestamp":1480373289,"event_type":"insert","id":2,"data":"a","other_data":"message","table":"test.t2"}
{"domain":0,"server_id":3000,"sequence":7434,"event_number":1,"timestamp":1480373293,"event_type":"insert","id":1,"data":"This","other_data":"is","table":"test.t2"}
```
