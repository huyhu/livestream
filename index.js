var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var path = require('path');
var RaspiCam = require("raspicam");

var spawn = require('child_process').spawn;
var proc;
var streamStarted = false;

app.use('/', express.static(path.join(__dirname, 'stream')));
app.use('/', express.static(path.join(__dirname, 'timelapse')));
app.use('/', express.static(__dirname));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

var camera = new RaspiCam({
  mode: "timelapse",
  output: "./timelapse/image_%02d.jpg", 
  encoding: "jpg",
  width: 640,
  height: 480,
  timelapse: 1000, // take a picture every 1 seconds
  timeout: 999999999, // timeout of camera proc
  q: 25
});

//listen for the "start" event triggered when the start method has been successfully initiated
camera.on("start", function(){
  console.log("camera started.");
  streamStarted = true;
});

//listen for the "read" event triggered when each new photo/video is saved
camera.on("read", function(err, timestamp, filename){ 
  console.log("new image " + filename);
  io.sockets.emit('liveStream', filename + '?_t=');
});

//listen for the "stop" event triggered when the stop method was called
camera.on("stop", function(){
  console.log("camera stopped");
  streamStarted = false;
});

//listen for the process to exit when the timeout has been reached
camera.on("exit", function(){
  console.log("camera timeout.");
  streamStarted = false;
});

var sockets = {};
var people = {};
var msgs = [];

io.on('connection', function(socket) {

  sockets[socket.id] = socket;
  console.log("Total clients connected : ", Object.keys(sockets).length);
  io.sockets.emit("update-people", people);

  socket.on('disconnect', function() {
    delete sockets[socket.id];

    io.sockets.emit("update", people[socket.id] + " has left the server.");
    delete people[socket.id];
    io.sockets.emit("update-people", people);
    if (Object.keys(sockets).length == 0) {
      msgs = [];
    }
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
    io.sockets.emit("history", msgs);
  });

  socket.on("send", function(msg){
    io.sockets.emit("chat", people[socket.id], msg);
    var item = {};
    item.name = people[socket.id];
    item.msg = msg;
    msgs.push(item);
  });
});

http.listen(80, function() {
  console.log('listening on *:80');
});

function stopStreaming() {
  if (Object.keys(sockets).length == 0) {
    if (proc) proc.kill();
    camera.stop();
  }
}

function raspi(){
  var args = ["-n", "-w", "640", "-h", "480", "-q", "75", "-o", __dirname + "/stream/image_stream.jpg", "-t", "9999999", "-tl", "250", "-th", "0:0:0"];
  proc = spawn('raspistill', args);
  proc.on('error', function(err) {
    console.log('amk ya: ' + err);
  });
}


function startStreaming(io) {
  if(streamStarted)
    return;

  console.log('Start streaming..');

  camera.start();
}
