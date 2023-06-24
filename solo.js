let cp = require("child_process");
let ffmpegProcess = cp.exec("sudo ffmpeg -f v4l2 -video_size 1280x720 -i /dev/video0 -pix_fmt yuv420p -preset ultrafast -c:v libx264 -b:v 600k -f rtsp rtsp://localhost:8554/scope");
ffmpegProcess.on("disconnect", function() {
  console.log("disconnected");
});
ffmpegProcess.on("spwan", function() {
  console.log("spwaned");
})
ffmpegProcess.on("message", function(data) {
  console.log("message", data);
});
ffmpegProcess.on("close", function(code) {
  console.log("closed", code);
});
ffmpegProcess.on("error", function(data) {
  console.log("error", data);
})