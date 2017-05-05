var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');

var spawn = require('child_process').spawn;
var proc;
var timerstarted;

app.use('/', express.static(path.join(__dirname, 'stream')));
app.use('/', express.static(__dirname));


app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var sockets = {};
var people = {};

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);
  io.sockets.emit("update-people", people);

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    io.sockets.emit("update", people[socket.id] + " has left the server.");
    delete people[socket.id];
    io.sockets.emit("update-people", people);
    // no more sockets, kill the stream
    stopStreaming();
  });

  socket.on('start-stream', function() {
    startStreaming(io);
  });

  socket.on("join", function(name){
    people[socket.id] = name;
    io.sockets.emit("update", name + " has joined the server.")
    io.sockets.emit("update-people", people);
  });

  socket.on("send", function(msg){
    io.sockets.emit("chat", people[socket.id], msg);
  });

});

http.listen(3000, function() {
  console.log('listening on *:3000');
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    app.set('watchingFile', false);
    if (proc) proc.kill();
    fs.unwatchFile(__dirname + '/stream/image_stream.jpg');
    clearInterval(restart);
  }
}

function raspi(){
  var args = ["-n", "-w", "640", "-h", "480", "-q", "75", "-o", __dirname + "/stream/image_stream.jpg", "-t", "9999999", "-tl", "250", "-th", "0:0:0"];
  proc = spawn('raspistill', args);
  proc.on('error', function(err) {
    console.log('amk ya: ' + err);
  });
}

function restart(){
  if (Object.keys(sockets).length == 0) return;
  timerstarted = true;
  console.log("restarting..");
  if (proc) proc.kill();
  raspi();
}

function startStreaming(io) {

  if (app.get('watchingFile')) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000) + "" + Object.keys(sockets).length);
    return;
  }

  raspi();
  if(!timerstarted)
    setInterval(restart, 1000 * 60 * 3);

  console.log('Watching for changes...');

  app.set('watchingFile', true);

  fs.watchFile(__dirname + '/stream/image_stream.jpg', function(current, previous) {
    io.sockets.emit('liveStream', 'image_stream.jpg?_t=' + (Math.random() * 100000) + "" + Object.keys(sockets).length);
  })
}
