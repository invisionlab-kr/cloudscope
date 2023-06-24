let cp = require("child_process");
let ffmpegProcess = cp.spawn("sudo", ["ffmpeg", "-f", "v4l2", "-video_size", "1280x720", "-i", "/dev/video0", "-pix_fmt yuv420p", "-preset", "ultrafast", "-c:v", "libx264", "-b:v", "600k", "-f", "rtsp", "rtsp://localhost:8554/scope"]);
