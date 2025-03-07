// WebCodecsConverter.tsx
import React, { useState, useRef, useEffect } from 'react';
import './index.css';

interface WebCodecsConverterProps {
  maxDurationSeconds?: number;
}

// 检查浏览器是否支持 WebCodecs API
const isWebCodecsSupported = () => {
  return typeof window !== 'undefined' && 
         'VideoEncoder' in window && 
         'VideoDecoder' in window &&
         'EncodedVideoChunk' in window;
};

const VideoConverter: React.FC<WebCodecsConverterProps> = ({ 
  maxDurationSeconds = 60 
}) => {
  const [inputVideo, setInputVideo] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<string>('h264');
  const [converting, setConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [outputUrl, setOutputUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const encodedChunksRef = useRef<any[]>([]);
  const frameCountRef = useRef<number>(0);
  const totalFramesRef = useRef<number>(0);
  
  // 检查浏览器支持
  useEffect(() => {
    setIsSupported(isWebCodecsSupported());
  }, []);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setInputVideo(file);
      
      const videoURL = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = videoURL;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            // 创建与视频相同尺寸的 canvas
            if (canvasRef.current) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }
          }
        };
      }
      
      setError('');
      setOutputUrl('');
    }
  };
  
  const convertVideo = async () => {
    if (!inputVideo || !videoRef.current || !canvasRef.current || !isSupported) return;
    
    try {
      setConverting(true);
      setProgress(0);
      encodedChunksRef.current = [];
      frameCountRef.current = 0;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setError('无法获取 Canvas 上下文');
        setConverting(false);
        return;
      }
      
      // 计算总帧数 (假设 30fps)
      const fps = 30;
      totalFramesRef.current = Math.min(video.duration, maxDurationSeconds) * fps;
      
      // 配置编码器
      const config: any = {
        codec: outputFormat === 'h264' ? 'avc1.42001E' : 'vp8',
        width: video.videoWidth,
        height: video.videoHeight,
        bitrate: 2_000_000, // 2 Mbps
        framerate: fps,
      };
      
      // 创建编码器
      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, metadata: any) => {
          // 收集编码后的视频块
          encodedChunksRef.current.push(chunk);
          
          // 更新进度
          frameCountRef.current++;
          const progressValue = Math.round((frameCountRef.current / totalFramesRef.current) * 100);
          setProgress(progressValue);
        },
        error: (e: any) => {
          setError(`编码错误: ${e.message}`);
          setConverting(false);
        }
      });
      
      // 初始化编码器
      await encoder.configure(config);
      
      // 重置视频到开始位置
      video.currentTime = 0;
      
      // 等待视频准备好
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });
      
      // 开始处理帧
      let frameCount = 0;
      const processFrame = async () => {
        if (frameCount >= totalFramesRef.current || video.currentTime >= maxDurationSeconds) {
          // 完成编码
          await encoder.flush();
          encoder.close();
          
          // 创建输出文件
          createOutputFile();
          return;
        }
        
        // 绘制当前视频帧到 canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 从 canvas 获取图像数据
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // 创建视频帧
        const videoFrame = new (window as any).VideoFrame(imageData, {
          timestamp: frameCount * (1000000 / fps), // 微秒时间戳
          duration: 1000000 / fps,
        });
        
        // 编码帧
        encoder.encode(videoFrame);
        videoFrame.close();
        
        // 移动到下一帧
        frameCount++;
        video.currentTime = frameCount / fps;
        
        // 等待视频准备好
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });
        
        // 处理下一帧
        requestAnimationFrame(processFrame);
      };
      
      // 开始处理
      processFrame();
      
    } catch (err) {
      console.error(err);
      setError(`视频转换失败: ${(err as Error).message}`);
      setConverting(false);
    }
  };
  
  // 创建输出文件
  const createOutputFile = () => {
    try {
      // 这里我们需要将编码后的块组装成一个可播放的视频文件
      // 为简化实现，我们使用 MediaRecorder API 作为中间步骤
      
      // 创建一个 MediaSource 对象
      const mediaSource = new MediaSource();
      const url = URL.createObjectURL(mediaSource);
      
      mediaSource.addEventListener('sourceopen', async () => {
        // 创建 SourceBuffer
        const mimeType = outputFormat === 'h264' ? 'video/mp4; codecs=avc1.42001E' : 'video/webm; codecs=vp8';
        let sourceBuffer;
        
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeType);
        } catch (e) {
          setError(`不支持的 MIME 类型: ${mimeType}`);
          setConverting(false);
          return;
        }
        
        // 将编码后的块转换为 ArrayBuffer
        const chunks = encodedChunksRef.current;
        const buffers = chunks.map(chunk => chunk.byteLength ? chunk : chunk.copyTo());
        
        // 按顺序添加到 SourceBuffer
        for (const buffer of buffers) {
          // 等待 SourceBuffer 准备好
          if (sourceBuffer.updating) {
            await new Promise<void>(resolve => {
              sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
            });
          }
          
          // 添加数据
          sourceBuffer.appendBuffer(buffer);
          
          // 等待添加完成
          await new Promise<void>(resolve => {
            sourceBuffer.addEventListener('updateend', () => resolve(), { once: true });
          });
        }
        
        // 结束流
        mediaSource.endOfStream();
        
        // 设置输出 URL
        setOutputUrl(url);
        setConverting(false);
      });
      
    } catch (err) {
      console.error(err);
      setError(`创建输出文件失败: ${(err as Error).message}`);
      setConverting(false);
    }
  };
  
  return (
    <div className="webcodecs-converter">
      <h2>WebCodecs 视频转换 (实验性)</h2>
      
      <div className="experimental-badge">实验性功能</div>
      
      {!isSupported ? (
        <div className="error-container">
          <h3>浏览器不支持</h3>
          <p>您的浏览器不支持 WebCodecs API。请使用 Chrome 88+ 或其他支持此 API 的浏览器。</p>
        </div>
      ) : (
        <>
          <div className="input-section">
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleFileChange} 
              disabled={converting}
            />
            
            <select 
              value={outputFormat} 
              onChange={(e) => setOutputFormat(e.target.value)}
              disabled={converting}
            >
              <option value="h264">H.264 (MP4)</option>
              <option value="vp8">VP8 (WebM)</option>
            </select>
            
            <button 
              onClick={convertVideo} 
              disabled={!inputVideo || converting}
            >
              {converting ? '转换中...' : '开始转换'}
            </button>
          </div>
          
          {error && <div className="error">{error}</div>}
          
          <div className="video-container">
            <div className="video-preview">
              <h3>输入视频</h3>
              <video ref={videoRef} controls width="320" />
            </div>
            
            {outputUrl && (
              <div className="video-preview">
                <h3>输出视频</h3>
                <video controls src={outputUrl} width="320" />
              </div>
            )}
          </div>
          
          {/* 隐藏的 canvas 用于处理视频帧 */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          
          {converting && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress" style={{ width: `${progress}%` }}></div>
                <span>{progress}%</span>
              </div>
              <p>正在转换视频，请勿关闭页面...</p>
            </div>
          )}
          
          {outputUrl && (
            <div className="output-section">
              <h3>转换完成!</h3>
              <a 
                href={outputUrl} 
                download={`converted-video.${outputFormat === 'h264' ? 'mp4' : 'webm'}`}
                className="download-button"
              >
                下载转换后的视频
              </a>
            </div>
          )}
          
          <div className="info">
            <p>注意: WebCodecs API 是实验性功能，可能不稳定或在某些浏览器中不可用</p>
            <p>最大处理时长: {maxDurationSeconds} 秒</p>
            <p>此功能最适合在 Chrome 88+ 版本中使用</p>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoConverter;
