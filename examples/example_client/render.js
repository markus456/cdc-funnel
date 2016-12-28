var canvas = document.getElementById('my-canvas')
var context = canvas.getContext('2d')
var stream = null
var speed = 1
var messages = 0
var drawTask = null
var objects = []

// Draw the statistics
function drawStats() {
    context.clearRect(0, 0, canvas.width, 30)
    context.fillStyle = 'black'
    context.font = "30px Arial"
    context.fillText("Speed: " + speed + " Events: " + messages, 0, 25)
}

// Draw objects at set intervals
//
// The drawing is delayed only for demonstrative purposes and this could be
// directly called in the `onmessage` handler
function drawObject() {
    for (i = 0; i < speed; i++) {
        if (objects.length > 0) {

            var obj = objects.shift()
            context.beginPath()

            if (obj.event_type == "insert") {
                context.fillStyle = 'green'
            } else if (obj.event_type == "delete") {
                context.fillStyle = 'red'
            } else if (obj.event_type == "update_before"){
                context.fillStyle = 'grey'
            } else {
                context.fillStyle = 'purple'
            }

            context.arc(35 + obj.x, 35 + obj.y, 3, 0, Math.PI * 2)
            context.fill()

            messages++
        }
    }
    drawStats()
}

// Open the event stream
function startStream() {
    objects = []
    messages = 0
    speed = 1

    stream = new EventSource("http://localhost:8080/?tables=test.t1")

    stream.onmessage = (event) => {
        var obj = JSON.parse(event.data)
        objects.push(obj)
    }

    drawTask = setInterval(drawObject, 1000 / 60)
}

// Close the event stream
function stopStream() {
    clearInterval(drawTask)
    context.clearRect(0, 0, canvas.width, canvas.height)
    if (stream) {
        stream.close()
        stream = null
    }
}

// Pause the drawing of the stream
//
// This does not actually stop the stream and objects are still received
function pauseStream() {
    if (drawTask) {
        clearInterval(drawTask)
        drawTask = null
    } else {
        drawTask = setInterval(drawObject, 1000 / 60)
    }
}

// Speed up the drawing
function faster() {
    speed++
    drawStats()
}

// Slow down the drawing
function slower() {
    if (speed > 1) {
        speed --
    }
    drawStats()
}
