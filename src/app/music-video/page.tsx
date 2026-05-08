'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Music, Image, Download, Loader2, CheckCircle, AlertCircle, Play, Video, Pause, Wand2, SkipBack, SkipForward, Volume2, VolumeX, FileVideo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function MusicVideoPage() {
  // 文件状态
  const [imageFile, setImageFile] = useState<{ name: string; size: number; url: string } | null>(null);
  const [audioFile, setAudioFile] = useState<{ name: string; size: number; url: string; duration: number } | null>(null);
  
  // 歌词
  const [lyrics, setLyrics] = useState<string>('');
  
  // 录制状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const [playerStyle, setPlayerStyle] = useState<'vinyl' | 'modern' | 'neon' | 'handwriting' | 'glass' | 'stage' | 'cloud' | 'anime' | 'wave'>('vinyl');
  const [lyricsOffset, setLyricsOffset] = useState(0); // 歌词开始时间（秒）
  const [songName, setSongName] = useState(''); // 歌曲名称（手动输入）
  const [artistName, setArtistName] = useState(''); // 歌手名称
  const [fontStyle, setFontStyle] = useState<'default' | 'handwriting' | 'neon' | 'retro' | 'modern' | 'cute'>('default'); // 字体样式
  const [isConverting, setIsConverting] = useState(false); // 转换状态
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false); // FFmpeg 加载状态
  const [convertProgress, setConvertProgress] = useState(0); // 转换进度
  
  // 预览状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const animateFnRef = useRef<(() => void) | null>(null);
  const drawPlayerRef = useRef<((ctx: CanvasRenderingContext2D, width: number, height: number, time: number, rotation?: number) => void) | null>(null);

  // 解析歌词 - 支持格式：[时间]歌词 或 时间|歌词
  const parseLyrics = (lyricsText: string): { time: number; text: string }[] => {
    const lines = lyricsText.split('\n').filter(line => line.trim());
    const parsed: { time: number; text: string }[] = [];
    
    lines.forEach(line => {
      // 格式1: [00:05] 歌词内容
      const match1 = line.match(/^\[(\d{1,2}):(\d{2})\]\s*(.+)$/);
      if (match1) {
        const mins = parseInt(match1[1], 10);
        const secs = parseInt(match1[2], 10);
        parsed.push({ time: mins * 60 + secs, text: match1[3] });
        return;
      }
      
      // 格式2: 00:05|歌词内容
      const match2 = line.match(/^(\d{1,2}:\d{2})\s*\|\s*(.+)$/);
      if (match2) {
        const timeParts = match2[1].split(':');
        const mins = parseInt(timeParts[0], 10);
        const secs = parseInt(timeParts[1], 10);
        parsed.push({ time: mins * 60 + secs, text: match2[2] });
        return;
      }
      
      // 纯文本：自动平均分配时间
      if (audioFile?.duration) {
        const avgTime = (parsed.length / lines.length) * audioFile.duration;
        parsed.push({ time: avgTime, text: line.trim() });
      }
    });
    
    // 按时间排序
    parsed.sort((a, b) => a.time - b.time);
    return parsed;
  };

  const lyricsList = lyrics ? parseLyrics(lyrics) : [];

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取显示的歌名
  const getDisplaySongName = (): string => {
    return songName.trim() || '歌曲名称';
  };

  // 字体样式配置
  const getFontStyleProps = (baseSize: number, isBold: boolean = true) => {
    const weight = isBold ? 'bold ' : '';
    const baseFont = 'sans-serif';
    const serifFont = 'serif';
    
    switch (fontStyle) {
      case 'handwriting':
        return { font: `${weight}${baseSize}px ${serifFont}`, shadow: { color: 'rgba(0,0,0,0.3)', blur: 4, offsetX: 2, offsetY: 2 } };
      case 'neon':
        return { font: `${weight}${baseSize}px ${baseFont}`, glow: true, glowColor: '#ff00ff', glowBlur: 20 };
      case 'retro':
        return { font: `${baseSize}px Impact, ${baseFont}`, shadow: { color: '#000', blur: 2, offsetX: 1, offsetY: 1 } };
      case 'modern':
        return { font: `900 ${baseSize}px ${baseFont}`, shadow: { color: 'rgba(0,0,0,0.5)', blur: 8, offsetX: 0, offsetY: 4 } };
      case 'cute':
        return { font: `${baseSize}px 'Comic Sans MS', cursive`, shadow: { color: 'rgba(255,105,180,0.5)', blur: 8, offsetX: 0, offsetY: 2 } };
      default:
        return { font: `${weight}${baseSize}px ${baseFont}`, shadow: null };
    }
  };

  // 绘制带样式的文字
  const drawStyledText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    baseSize: number,
    isBold: boolean = true,
    color: string = '#fff',
    textAlign: CanvasTextAlign = 'center'
  ) => {
    const style = getFontStyleProps(baseSize, isBold);
    ctx.font = style.font;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    
    if ('glow' in style && style.glow) {
      ctx.shadowColor = style.glowColor;
      ctx.shadowBlur = style.glowBlur;
    } else if (style.shadow) {
      ctx.shadowColor = style.shadow.color;
      ctx.shadowBlur = style.shadow.blur;
      ctx.shadowOffsetX = style.shadow.offsetX;
      ctx.shadowOffsetY = style.shadow.offsetY;
    }
    
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  // 绘制播放器界面到 Canvas
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, time: number, rotation: number = 0) => {
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const progress = audioFile ? (time / audioFile.duration) : 0;

    // 根据样式绘制
    if (playerStyle === 'vinyl') {
      // ===== 复古黑胶唱片 =====
      if (imageFile?.url) {
        ctx.save();
        ctx.filter = 'blur(40px)';
        ctx.globalAlpha = 0.6;
        const img = new window.Image();
        img.src = imageFile.url;
        if (img.complete) {
          const scale = Math.max(width / img.width, height / img.height);
          ctx.drawImage(img, (width - img.width * scale) / 2, (height - img.height * scale) / 2, img.width * scale, img.height * scale);
        }
        ctx.restore();
      } else {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#78350f');
        gradient.addColorStop(0.5, '#292524');
        gradient.addColorStop(1, '#1c1917');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);

      const discRadius = Math.min(width, height) * 0.35;
      const centerY = height * 0.4;
      
      // 旋转的唱片主体
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.clip();
      
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) {
          ctx.drawImage(img, centerX - discRadius, centerY - discRadius, discRadius * 2, discRadius * 2);
        }
      } else {
        ctx.fillStyle = '#292524';
        ctx.fillRect(centerX - discRadius, centerY - discRadius, discRadius * 2, discRadius * 2);
        ctx.fillStyle = '#d97706';
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♪', centerX, centerY);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 4;
      ctx.stroke();

      const innerRadius = discRadius * 0.15;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
      centerGradient.addColorStop(0, '#b45309');
      centerGradient.addColorStop(1, '#78350f');
      ctx.fillStyle = centerGradient;
      ctx.fill();

      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.75, Math.min(28, width * 0.06), true, '#fff');

      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + Math.min(24, width * 0.05) + 'px sans-serif';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.fillText(currentLyric, centerX, height * 0.87);
          ctx.shadowBlur = 0;
        }
      }

      const progressBarWidth = width * 0.7;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.92, progressBarWidth, 4, 2);
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.92, progressBarWidth * progress, 4, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.font = Math.min(12, width * 0.03) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(time), (width - progressBarWidth) / 2, height * 0.96);
      ctx.textAlign = 'right';
      ctx.fillText(audioFile ? formatTime(audioFile.duration) : '0:00', (width + progressBarWidth) / 2, height * 0.96);
    } else if (playerStyle === 'modern') {
      // ===== 现代极简 =====
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(1, '#1e293b');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const coverSize = width * 0.7;
      const coverY = height * 0.15;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect((width - coverSize) / 2, coverY, coverSize, coverSize, 20);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect((width - coverSize) / 2, coverY, coverSize, coverSize, 20);
          ctx.clip();
          ctx.drawImage(img, (width - coverSize) / 2, coverY, coverSize, coverSize);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect((width - coverSize) / 2, coverY, coverSize, coverSize, 20);
        ctx.fill();
      }
      ctx.restore();

      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.72, Math.min(32, width * 0.07), true, '#fff');
      ctx.fillStyle = '#94a3b8';
      ctx.font = Math.min(18, width * 0.04) + 'px sans-serif';
      ctx.fillText(artistName || '歌手', centerX, height * 0.77);

      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = Math.min(22, width * 0.05) + 'px sans-serif';
          ctx.fillText(currentLyric, centerX, height * 0.85);
        }
      }

      const progressBarWidth = width * 0.8;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.9, progressBarWidth, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.9, progressBarWidth * progress, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = Math.min(14, width * 0.03) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatTime(time), (width - progressBarWidth) / 2, height * 0.95);
      ctx.textAlign = 'right';
      ctx.fillText(audioFile ? formatTime(audioFile.duration) : '0:00', (width + progressBarWidth) / 2, height * 0.95);
    } else if (playerStyle === 'neon') {
      // ===== 霓虹赛博 =====
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#1a0533');
      gradient.addColorStop(0.5, '#0d0d1a');
      gradient.addColorStop(1, '#050510');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(138, 43, 226, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      const discRadius = Math.min(width, height) * 0.3;
      const centerY = height * 0.38;
      
      ctx.save();
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 50;
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // 旋转的唱片封面
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius - 5, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, centerX - discRadius + 5, centerY - discRadius + 5, (discRadius - 5) * 2, (discRadius - 5) * 2);
      } else {
        ctx.fillStyle = '#2d1b4e';
        ctx.fillRect(centerX - discRadius + 5, centerY - discRadius + 5, (discRadius - 5) * 2, (discRadius - 5) * 2);
      }
      ctx.restore();

      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.72, Math.min(28, width * 0.06), true, '#00ffff');
      ctx.fillStyle = '#ff00ff';
      ctx.font = Math.min(16, width * 0.04) + 'px sans-serif';
      ctx.fillText('CYBER BEAT', centerX, height * 0.78);

      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.save();
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#fff';
          ctx.font = 'bold ' + Math.min(24, width * 0.05) + 'px sans-serif';
          ctx.fillText(currentLyric, centerX, height * 0.87);
          ctx.restore();
        }
      }

      const progressBarWidth = width * 0.7;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.92, progressBarWidth, 4, 2);
      ctx.fill();
      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.92, progressBarWidth * progress, 4, 2);
      ctx.fill();
      ctx.restore();
    } else if (playerStyle === 'handwriting') {
      // ===== 手账日记 =====
      ctx.fillStyle = '#fef9e7';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = 'rgba(139, 119, 101, ' + (Math.random() * 0.03) + ')';
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, width - 40, height - 40);
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      const photoWidth = width * 0.5;
      const photoHeight = photoWidth * 1.2;
      const photoX = (width - photoWidth) / 2;
      const photoY = height * 0.12;
      
      ctx.fillStyle = '#fff';
      ctx.fillRect(photoX - 10, photoY - 10, photoWidth + 20, photoHeight + 30);
      
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(photoX, photoY, photoWidth, photoHeight);
          ctx.clip();
          ctx.drawImage(img, photoX, photoY, photoWidth, photoHeight);
          ctx.restore();
        }
      } else {
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
      }

      ctx.fillStyle = '#5d4e37';
      ctx.font = Math.min(14, width * 0.03) + 'px serif';
      ctx.textAlign = 'left';
      const today = new Date();
      const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
      ctx.fillText(dateStr, photoX, photoY + photoHeight + 20);

      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.68, Math.min(24, width * 0.05), true, '#2c1810');

      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = '#5d4e37';
          ctx.font = Math.min(20, width * 0.045) + 'px serif';
          ctx.fillText(currentLyric, centerX, height * 0.78);
        }
      }

      ctx.fillStyle = '#8b7355';
      ctx.font = '24px serif';
      ctx.fillText('♪ ♫', width * 0.15, height * 0.75);
      ctx.fillText('♪ ♫', width * 0.8, height * 0.85);

      const progressBarWidth = width * 0.6;
      ctx.fillStyle = 'rgba(139, 115, 85, 0.3)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.88, progressBarWidth, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#8b7355';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.88, progressBarWidth * progress, 6, 3);
      ctx.fill();
    } else if (playerStyle === 'glass') {
      // ===== 玻璃极简 =====
      if (imageFile?.url) {
        const img = new window.Image();
        img.src = imageFile.url;
        if (img.complete) {
          const scale = Math.max(width / img.width, height / img.height);
          ctx.drawImage(img, (width - img.width * scale) / 2, (height - img.height * scale) / 2, img.width * scale, img.height * scale);
        }
      } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, 0, width, height);

      const discRadius = Math.min(width, height) * 0.32;
      const centerY = height * 0.38;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // 旋转的唱片封面
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -centerY);
      ctx.beginPath();
      ctx.arc(centerX, centerY, discRadius - 15, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, centerX - discRadius + 15, centerY - discRadius + 15, (discRadius - 15) * 2, (discRadius - 15) * 2);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(centerX - discRadius + 15, centerY - discRadius + 15, (discRadius - 15) * 2, (discRadius - 15) * 2);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.font = 'bold ' + Math.min(26, width * 0.055) + 'px sans-serif';
      ctx.textAlign = 'center';
      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.73, Math.min(26, width * 0.055), true, 'rgba(255, 255, 255, 0.95)');

      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = Math.min(20, width * 0.045) + 'px sans-serif';
          ctx.fillText(currentLyric, centerX, height * 0.82);
        }
      }

      const progressBarWidth = width * 0.7;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.9, progressBarWidth, 4, 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.roundRect((width - progressBarWidth) / 2, height * 0.9, progressBarWidth * progress, 4, 2);
      ctx.fill();
    } else if (playerStyle === 'stage') {
      // ===== 舞台沉浸风 =====
      // 深蓝紫色渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0a0a1a');
      gradient.addColorStop(0.5, '#1a1a3a');
      gradient.addColorStop(1, '#2a1a4a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // 舞台灯光效果
      ctx.save();
      ctx.globalAlpha = 0.15;
      const lightGradient = ctx.createRadialGradient(centerX, height * 0.3, 0, centerX, height * 0.3, width * 0.8);
      lightGradient.addColorStop(0, '#4a90d9');
      lightGradient.addColorStop(0.5, '#2a50a9');
      lightGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = lightGradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      
      // 顶部装饰线
      ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const y = height * 0.05 + i * 15;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y + Math.sin(time * 2 + i) * 3);
        ctx.stroke();
      }
      
      // 中心大唱片
      const discRadius = Math.min(width, height) * 0.38;
      const discY = height * 0.35;
      
      // 唱片阴影
      ctx.save();
      ctx.shadowColor = 'rgba(100, 150, 255, 0.5)';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      
      // 唱片主体（旋转）
      ctx.save();
      ctx.translate(centerX, discY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -discY);
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, centerX - discRadius, discY - discRadius, discRadius * 2, discRadius * 2);
      } else {
        ctx.fillStyle = '#1a1a3a';
        ctx.fillRect(centerX - discRadius, discY - discRadius, discRadius * 2, discRadius * 2);
        ctx.fillStyle = '#4a90d9';
        ctx.font = '60px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♪', centerX, discY);
      }
      ctx.restore();
      
      // 唱片中心
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius * 0.12, 0, Math.PI * 2);
      const discCenterGradient = ctx.createRadialGradient(centerX, discY, 0, centerX, discY, discRadius * 0.12);
      discCenterGradient.addColorStop(0, '#64b5f6');
      discCenterGradient.addColorStop(1, '#1a1a3a');
      ctx.fillStyle = discCenterGradient;
      ctx.fill();
      
      // 歌曲名称
      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.78, Math.min(32, width * 0.07), true, '#fff');
      
      // 歌词显示（舞台风格）
      if (showLyrics && lyricsList.length > 0) {
        // 找到当前歌词和前后各一句
        let currentIndex = -1;
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentIndex = i; break; }
        }
        
        if (currentIndex >= 0) {
          const lyricsY = height * 0.86;
          
          // 前一句（淡化）
          if (currentIndex > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = Math.min(18, width * 0.04) + 'px sans-serif';
            ctx.fillText(lyricsList[currentIndex - 1].text, centerX, lyricsY - 35);
          }
          
          // 当前句（高亮）
          ctx.fillStyle = '#64b5f6';
          ctx.font = 'bold ' + Math.min(28, width * 0.06) + 'px sans-serif';
          ctx.shadowColor = '#64b5f6';
          ctx.shadowBlur = 20;
          ctx.fillText(lyricsList[currentIndex].text, centerX, lyricsY);
          ctx.shadowBlur = 0;
          
          // 后一句（淡化）
          if (currentIndex < lyricsList.length - 1) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = Math.min(18, width * 0.04) + 'px sans-serif';
            ctx.fillText(lyricsList[currentIndex + 1].text, centerX, lyricsY + 35);
          }
        }
      }
      
      // 底部装饰线
      ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = height * 0.92 + i * 12;
        ctx.beginPath();
        ctx.moveTo(width * 0.2, y);
        ctx.lineTo(width * 0.8, y + Math.sin(time * 3 + i) * 2);
        ctx.stroke();
      }
    } else if (playerStyle === 'cloud') {
      // ===== 云端清新风 =====
      // 粉蓝渐变天空
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, '#a8d8ea');
      skyGradient.addColorStop(0.4, '#d4e8f0');
      skyGradient.addColorStop(0.6, '#f8e8e8');
      skyGradient.addColorStop(1, '#ffeef2');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);
      
      // 云朵效果
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < 5; i++) {
        const cloudX = ((time * 10 + i * 200) % (width + 200)) - 100;
        const cloudY = 50 + i * 30;
        ctx.beginPath();
        ctx.ellipse(cloudX, cloudY, 80, 30, 0, 0, Math.PI * 2);
        ctx.ellipse(cloudX + 40, cloudY - 10, 50, 25, 0, 0, Math.PI * 2);
        ctx.ellipse(cloudX - 30, cloudY + 5, 45, 20, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      ctx.restore();
      
      // 水面倒影
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.translate(0, height);
      ctx.scale(1, -0.3);
      const reflectionGradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
      reflectionGradient.addColorStop(0, '#a8d8ea');
      reflectionGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = reflectionGradient;
      ctx.fillRect(0, height * 0.6, width, height * 0.4);
      ctx.restore();
      
      // 创作者标签
      ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
      ctx.font = Math.min(14, width * 0.035) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('@音乐创作者', width * 0.05, 30);
      
      // CD唱片
      const cdRadius = Math.min(width, height) * 0.32;
      const cdY = height * 0.4;
      
      // CD阴影
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, cdY, cdRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
      
      // CD封面（旋转）
      ctx.save();
      ctx.translate(centerX, cdY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -cdY);
      ctx.beginPath();
      ctx.arc(centerX, cdY, cdRadius - 5, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, centerX - cdRadius + 5, cdY - cdRadius + 5, (cdRadius - 5) * 2, (cdRadius - 5) * 2);
      } else {
        ctx.fillStyle = '#ffb6c1';
        ctx.fillRect(centerX - cdRadius + 5, cdY - cdRadius + 5, (cdRadius - 5) * 2, (cdRadius - 5) * 2);
      }
      ctx.restore();
      
      // CD边缘（金色）
      ctx.beginPath();
      ctx.arc(centerX, cdY, cdRadius - 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 6;
      ctx.stroke();
      
      // CD中心
      ctx.beginPath();
      ctx.arc(centerX, cdY, cdRadius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(centerX, cdY, cdRadius * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      
      // 歌曲名称
      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.74, Math.min(26, width * 0.055), true, '#333');
      
      // 歌词（双语风格）
      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = '#666';
          ctx.font = Math.min(20, width * 0.045) + 'px sans-serif';
          ctx.fillText(currentLyric, centerX, height * 0.82);
        }
      }
      
      // 播放控件装饰
      ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
      ctx.beginPath();
      ctx.roundRect(width * 0.3, height * 0.88, width * 0.4, 50, 10);
      ctx.fill();
    } else if (playerStyle === 'anime') {
      // ===== 二次元风格 =====
      // 梦幻渐变背景
      const animeGradient = ctx.createLinearGradient(0, 0, width, height);
      animeGradient.addColorStop(0, '#ffecd2');
      animeGradient.addColorStop(0.3, '#fcb69f');
      animeGradient.addColorStop(0.6, '#a8edea');
      animeGradient.addColorStop(1, '#fed6e3');
      ctx.fillStyle = animeGradient;
      ctx.fillRect(0, 0, width, height);
      
      // 星星装饰
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) {
        const starX = (Math.sin(i * 127.1 + time * 0.5) * 0.5 + 0.5) * width;
        const starY = (Math.cos(i * 269.5 + time * 0.3) * 0.5 + 0.5) * height * 0.5;
        const starSize = 2 + Math.sin(time * 2 + i) * 1;
        ctx.beginPath();
        ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // 搜索栏装饰
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.roundRect(width * 0.05, 20, width * 0.3, 35, 17);
      ctx.fill();
      ctx.fillStyle = '#ccc';
      ctx.font = Math.min(14, width * 0.035) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🔍 搜索', width * 0.08, 43);
      
      // 左侧圆形唱片
      const circleRadius = Math.min(width, height) * 0.28;
      const circleY = height * 0.42;
      
      // 唱片外圈
      ctx.save();
      ctx.shadowColor = 'rgba(255, 105, 180, 0.5)';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(width * 0.3, circleY, circleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
      
      // 耳机装饰
      ctx.strokeStyle = '#ff69b4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(width * 0.3, circleY - circleRadius * 0.3, circleRadius * 0.5, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      
      // 唱片封面（旋转）
      ctx.save();
      ctx.translate(width * 0.3, circleY);
      ctx.rotate(rotation);
      ctx.translate(-width * 0.3, -circleY);
      ctx.beginPath();
      ctx.arc(width * 0.3, circleY, circleRadius - 8, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, width * 0.3 - circleRadius + 8, circleY - circleRadius + 8, (circleRadius - 8) * 2, (circleRadius - 8) * 2);
      } else {
        ctx.fillStyle = '#ffb6c1';
        ctx.fillRect(width * 0.3 - circleRadius + 8, circleY - circleRadius + 8, (circleRadius - 8) * 2, (circleRadius - 8) * 2);
        ctx.fillStyle = '#fff';
        ctx.font = '40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎵', width * 0.3, circleY);
      }
      ctx.restore();
      
      // 唱片中心
      ctx.beginPath();
      ctx.arc(width * 0.3, circleY, circleRadius * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      
      // 歌曲名称
      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.78, Math.min(24, width * 0.05), true, '#333');
      
      // 歌词（滚动风格）
      if (showLyrics && lyricsList.length > 0) {
        let currentIndex = -1;
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentIndex = i; break; }
        }
        
        if (currentIndex >= 0) {
          ctx.fillStyle = '#666';
          ctx.font = Math.min(22, width * 0.05) + 'px sans-serif';
          
          // 显示当前和下一句
          const lyric1 = lyricsList[currentIndex]?.text || '';
          const lyric2 = lyricsList[currentIndex + 1]?.text || '';
          
          ctx.fillText(lyric1, width * 0.7, height * 0.65);
          if (lyric2) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.font = Math.min(16, width * 0.04) + 'px sans-serif';
            ctx.fillText(lyric2, width * 0.7, height * 0.72);
          }
        }
      }
      
      // 日期标签
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.roundRect(width * 0.7, height * 0.88, width * 0.25, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ff69b4';
      ctx.font = Math.min(12, width * 0.03) + 'px sans-serif';
      ctx.textAlign = 'center';
      const today = new Date();
      ctx.fillText(today.getMonth() + 1 + '/' + today.getDate(), width * 0.825, height * 0.905);
    } else if (playerStyle === 'wave') {
      // ===== 波形进度条风格 =====
      // 深色背景
      const waveGradient = ctx.createLinearGradient(0, 0, 0, height);
      waveGradient.addColorStop(0, '#1a1a2e');
      waveGradient.addColorStop(1, '#16213e');
      ctx.fillStyle = waveGradient;
      ctx.fillRect(0, 0, width, height);
      
      // 动态网格
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }
      for (let i = 0; i < height; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
      
      // 音频波形（背景装饰）
      ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
      const barCount = 50;
      const waveBarWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.abs(Math.sin(i * 0.3 + time * 5)) * height * 0.3 + 10;
        const x = i * waveBarWidth;
        const y = height * 0.5 - barHeight / 2;
        ctx.fillRect(x, y, waveBarWidth - 2, barHeight);
      }
      
      // 唱片
      const discRadius = Math.min(width, height) * 0.3;
      const discY = height * 0.35;
      
      // 发光效果
      ctx.save();
      ctx.shadowColor = '#00d9ff';
      ctx.shadowBlur = 50;
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#00d9ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      
      // 唱片封面（旋转）
      ctx.save();
      ctx.translate(centerX, discY);
      ctx.rotate(rotation);
      ctx.translate(-centerX, -discY);
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius - 10, 0, Math.PI * 2);
      ctx.clip();
      if (imageFile?.url) {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.src = imageFile.url;
        if (img.complete) ctx.drawImage(img, centerX - discRadius + 10, discY - discRadius + 10, (discRadius - 10) * 2, (discRadius - 10) * 2);
      } else {
        ctx.fillStyle = '#0f3460';
        ctx.fillRect(centerX - discRadius + 10, discY - discRadius + 10, (discRadius - 10) * 2, (discRadius - 10) * 2);
        ctx.fillStyle = '#00d9ff';
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎵', centerX, discY);
      }
      ctx.restore();
      
      // 唱片中心
      ctx.beginPath();
      ctx.arc(centerX, discY, discRadius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#00d9ff';
      ctx.fill();
      
      // 歌曲名称
      drawStyledText(ctx, getDisplaySongName(), centerX, height * 0.72, Math.min(28, width * 0.06), true, '#fff');
      
      // 账号标签
      ctx.fillStyle = 'rgba(0, 217, 255, 0.7)';
      ctx.font = Math.min(14, width * 0.035) + 'px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('@音乐达人', width * 0.95, 30);
      
      // 歌词
      if (showLyrics && lyricsList.length > 0) {
        let currentLyric = '';
        for (let i = lyricsList.length - 1; i >= 0; i--) {
          if (time >= lyricsList[i].time) { currentLyric = lyricsList[i].text; break; }
        }
        if (currentLyric) {
          ctx.fillStyle = '#00d9ff';
          ctx.font = Math.min(24, width * 0.05) + 'px sans-serif';
          ctx.shadowColor = '#00d9ff';
          ctx.shadowBlur = 10;
          ctx.fillText(currentLyric, centerX, height * 0.82);
          ctx.shadowBlur = 0;
        }
      }
      
      // 波形进度条
      const progressBarWidth = width * 0.7;
      const barY = height * 0.9;
      
      // 已播放部分（动态波形）
      ctx.fillStyle = '#00d9ff';
      const playedBars = Math.floor(barCount * progress);
      for (let i = 0; i < playedBars; i++) {
        const waveHeight = Math.abs(Math.sin(i * 0.5 + time * 8)) * 15 + 5;
        const x = (width - progressBarWidth) / 2 + i * (progressBarWidth / barCount);
        ctx.fillRect(x, barY - waveHeight / 2, (progressBarWidth / barCount) - 2, waveHeight);
      }
      
      // 未播放部分（灰色）
      ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
      for (let i = playedBars; i < barCount; i++) {
        const waveHeight = 5;
        const x = (width - progressBarWidth) / 2 + i * (progressBarWidth / barCount);
        ctx.fillRect(x, barY - waveHeight / 2, (progressBarWidth / barCount) - 2, waveHeight);
      }
    }
  }, [imageFile, audioFile, lyricsList, showLyrics, playerStyle, artistName, fontStyle, songName, formatTime]);


  // 播放/暂停预览
  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio || !audioFile) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 动画循环（用于预览和录制）
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const audio = audioRef.current;
    
    if (ctx && canvas && audio && isRecordingRef.current) {
      const time = audio.currentTime || 0;
      setCurrentTime(time);
      // 计算旋转角度：每秒旋转约0.5圈
      const rotation = time * Math.PI * 1;
      drawPlayerRef.current?.(ctx, canvas.width, canvas.height, time, rotation);
      animationRef.current = requestAnimationFrame(() => animateFnRef.current?.());
    }
  }, []);

  // 保存 animate 引用
  useEffect(() => {
    animateFnRef.current = animate;
  }, [animate]);

  // 开始录制
  const startRecording = async () => {
    if (!audioFile || !canvasRef.current || !audioRef.current) return;

    // 重置音频
    const audio = audioRef.current;
    audio.currentTime = 0;

    // 设置 Canvas
    const canvas = canvasRef.current;
    canvas.width = 1080;
    canvas.height = 1920;

    // 初始绘制
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawPlayer(ctx, canvas.width, canvas.height, 0, 0);
    }

    // 开始录制
    const stream = canvas.captureStream(30);
    
    // 获取音频轨道
    let audioTrack: MediaStreamTrack | null = null;
    try {
      const audioEl = audioRef.current;
      const audioContext = new window.AudioContext();
      const mediaStreamDestination = audioContext.createMediaStreamDestination();
      const source = audioContext.createMediaElementSource(audioEl);
      source.connect(mediaStreamDestination);
      audioTrack = mediaStreamDestination.stream.getAudioTracks()[0];
    } catch {
      // 音频捕获失败，继续只录视频
    }

    // 合并流
    const tracks = [stream.getVideoTracks()[0], audioTrack].filter(Boolean) as MediaStreamTrack[];
    const combinedStream = new MediaStream(tracks);

    const mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp8'
    });

    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setIsRecording(false);
      setRecordingProgress(0);
      isRecordingRef.current = false;
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    isRecordingRef.current = true;

    // 播放音频
    audio.play();
    setIsPlaying(true);

    // 开始动画
    animateFnRef.current?.();

    // 更新进度
    const progressInterval = setInterval(() => {
      if (audio.duration) {
        setRecordingProgress((audio.currentTime / audio.duration) * 100);
      }
    }, 100);

    audio.onended = () => {
      clearInterval(progressInterval);
      if (mediaRecorder.state === 'recording') {
        setTimeout(() => {
          mediaRecorder.stop();
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          setIsPlaying(false);
        }, 500);
      }
    };
  };

  // 停止录制
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    isRecordingRef.current = false;
    setIsPlaying(false);
    setIsRecording(false);
  };

  // 下载视频
  const downloadVideo = () => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${audioFile?.name.replace(/\.[^/.]+$/, '') || 'music'}_video.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 预览动画
  useEffect(() => {
    if (isPlaying && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const audio = audioRef.current;
      
      if (ctx && audio) {
        const loop = () => {
          const time = audio.currentTime || 0;
          setCurrentTime(time);
          // 计算旋转角度：每秒旋转约0.5圈
          const rotation = time * Math.PI * 1;
          drawPlayerRef.current?.(ctx, canvas.width, canvas.height, time, rotation);
          animationRef.current = requestAnimationFrame(loop);
        };
        loop();
      }
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // 同步 drawPlayer 到 ref
  useEffect(() => {
    drawPlayerRef.current = drawPlayer;
  }, [drawPlayer]);

  // FFmpeg 转换函数
  const ffmpegRef = useRef<FFmpeg | null>(null);

  // 初始化 FFmpeg
  const initFFmpeg = useCallback(async () => {
    if (ffmpegRef.current || ffmpegLoaded) return ffmpegRef.current;
    
    try {
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      
      ffmpeg.on('progress', ({ progress }) => {
        setConvertProgress(Math.round(progress * 100));
      });

      // 尝试多个 CDN 源，确保加载成功
      const cdnUrls = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
      ];

      let loaded = false;
      for (const baseURL of cdnUrls) {
        try {
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          loaded = true;
          break;
        } catch {
          console.log(`CDN ${baseURL} 加载失败，尝试下一个...`);
        }
      }

      if (!loaded) {
        throw new Error('所有 CDN 都加载失败');
      }

      setFfmpegLoaded(true);
      return ffmpeg;
    } catch (error) {
      console.error('FFmpeg 加载失败:', error);
      return null;
    }
  }, [ffmpegLoaded]);

  // 转换 WebM 为 MP4
  const convertToMp4 = useCallback(async (webmBlob: Blob): Promise<Blob | null> => {
    try {
      setIsConverting(true);
      setConvertProgress(0);

      const ffmpeg = await initFFmpeg();
      if (!ffmpeg) {
        console.log('FFmpeg 加载失败，将下载 WebM 格式');
        return null;
      }

      // 写入 WebM 文件
      const webmData = await fetchFile(webmBlob);
      await ffmpeg.writeFile('input.webm', webmData);

      // 转换为 MP4
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental',
        'output.mp4'
      ]);

      // 读取输出文件
      const data = await ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([data as BlobPart], { type: 'video/mp4' });

      // 清理
      await ffmpeg.deleteFile('input.webm');
      await ffmpeg.deleteFile('output.mp4');

      setIsConverting(false);
      setConvertProgress(0);
      return mp4Blob;
    } catch (error) {
      console.error('转换失败:', error);
      setIsConverting(false);
      setConvertProgress(0);
      return null;
    }
  }, [initFFmpeg]);

  // 图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64 = await readFileAsBase64(file);
    setImageFile({
      name: file.name,
      size: file.size,
      url: base64,
    });
  };

  // 音频上传
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64 = await readFileAsBase64(file);
    const audio = new Audio(base64);
    
    audio.addEventListener('loadedmetadata', () => {
      setAudioFile({
        name: file.name,
        size: file.size,
        url: base64,
        duration: audio.duration,
      });
      setCurrentTime(0);
      setIsPlaying(false);
    });
  };

  // 生成歌词时间轴（前端直接实现）
  const generateTimeline = () => {
    console.log('generateTimeline called', { audioFile, lyricsLength: lyrics?.length });
    
    if (!audioFile) {
      alert('请先上传音频文件');
      return;
    }
    
    if (!lyrics?.trim()) {
      alert('请输入歌词');
      return;
    }

    const duration = audioFile.duration;
    console.log('audio duration:', duration);
    
    if (!duration || duration === 0 || isNaN(duration)) {
      alert('音频时长获取失败，请等待音频加载完成后再试');
      return;
    }

    const lines = lyrics.split('\n').filter(line => {
      const trimmed = line.trim();
      // 过滤空行和已格式化的歌词行
      if (!trimmed) return false;
      if (/^\[\d/.test(trimmed)) return false;
      if (/^\d{1,2}:\d/.test(trimmed)) return false;
      return true;
    });

    if (lines.length === 0) {
      alert('请输入纯文本歌词（不要带时间格式）');
      return;
    }

    // 计算歌词演唱部分的总时长（扣除偏移时间）
    const singDuration = duration - lyricsOffset;
    const avgTime = singDuration / lines.length;
    console.log('Generating timeline for', lines.length, 'lines, offset:', lyricsOffset, 'singDuration:', singDuration, 'avgTime:', avgTime);
    
    const formattedLines = lines.map((line, index) => {
      // 歌词从偏移时间开始
      const time = Math.floor(lyricsOffset + index * avgTime);
      const mins = Math.floor(time / 60);
      const secs = time % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      return `[${timeStr}] ${line.trim()}`;
    });

    setLyrics(formattedLines.join('\n'));
    console.log('Timeline generated successfully');
  };

  // 读取文件为 base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-stone-900 to-stone-950 text-white">
      {/* 头部 */}
      <header className="border-b border-amber-800/30 bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-amber-100 flex items-center gap-3">
            <Video className="w-6 h-6 text-amber-500" />
            播放器视频生成器
          </h1>
          <p className="text-amber-200/60 mt-1">生成播放器界面风格的视频，完整保留音频</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 文件上传 */}
          <Card className="bg-stone-900/80 border-amber-800/30">
            <CardHeader>
              <CardTitle className="text-amber-100">上传文件</CardTitle>
              <CardDescription className="text-amber-200/60">
                上传专辑封面和音频文件
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 专辑封面 */}
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer bg-stone-800/50 hover:bg-stone-700/50 border border-amber-700/50 rounded-lg p-4 flex items-center gap-3 transition-colors">
                  <Image className="w-10 h-10 text-amber-500" />
                  <div>
                    <p className="text-amber-100 font-medium">上传专辑封面</p>
                    <p className="text-amber-200/50 text-sm">JPG、PNG、WebP</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                
                {imageFile && (
                  <div className="flex items-center gap-3 bg-stone-800/50 rounded-lg p-2 border border-amber-700/30">
                    <img src={imageFile.url} alt="预览" className="w-12 h-12 rounded object-cover" />
                    <div className="text-sm">
                      <p className="text-amber-100 truncate max-w-32">{imageFile.name}</p>
                      <p className="text-amber-200/50">{formatFileSize(imageFile.size)}</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>

              {/* 音频文件 */}
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer bg-stone-800/50 hover:bg-stone-700/50 border border-amber-700/50 rounded-lg p-4 flex items-center gap-3 transition-colors">
                  <Music className="w-10 h-10 text-amber-500" />
                  <div>
                    <p className="text-amber-100 font-medium">上传音频文件</p>
                    <p className="text-amber-200/50 text-sm">MP3、WAV、M4A</p>
                  </div>
                  <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                </label>
                
                {audioFile && (
                  <div className="flex items-center gap-3 bg-stone-800/50 rounded-lg p-2 border border-amber-700/30">
                    <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="text-sm">
                      <p className="text-amber-100 truncate max-w-32">{audioFile.name}</p>
                      <p className="text-amber-200/50">{formatTime(audioFile.duration)} · {formatFileSize(audioFile.size)}</p>
                    </div>
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 播放器样式选择 */}
          <Card className="bg-stone-900/80 border-amber-800/30">
            <CardHeader>
              <CardTitle className="text-amber-100">播放器样式</CardTitle>
              <CardDescription className="text-amber-200/60">
                选择你喜欢的播放器界面风格
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                <button
                  onClick={() => setPlayerStyle('vinyl')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'vinyl'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">📀</div>
                  <div className="text-xs text-amber-200">复古黑胶</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('stage')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'stage'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">🎤</div>
                  <div className="text-xs text-amber-200">舞台沉浸</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('cloud')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'cloud'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">☁️</div>
                  <div className="text-xs text-amber-200">云端清新</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('anime')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'anime'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">🎀</div>
                  <div className="text-xs text-amber-200">二次元</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('wave')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'wave'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">📊</div>
                  <div className="text-xs text-amber-200">波形进度</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('modern')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'modern'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">💿</div>
                  <div className="text-xs text-amber-200">现代极简</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('neon')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'neon'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">🌆</div>
                  <div className="text-xs text-amber-200">霓虹赛博</div>
                </button>
                <button
                  onClick={() => setPlayerStyle('glass')}
                  className={`p-2 rounded-lg border-2 transition-all ${
                    playerStyle === 'glass'
                      ? 'border-amber-500 bg-amber-500/20'
                      : 'border-stone-700 bg-stone-800/50 hover:border-amber-600/50'
                  }`}
                >
                  <div className="text-xl mb-1">✨</div>
                  <div className="text-xs text-amber-200">玻璃极简</div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 歌词输入 */}
          <Card className="bg-stone-900/80 border-amber-800/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-amber-100">歌词设置</CardTitle>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className={`text-sm font-medium transition-colors ${showLyrics ? 'text-amber-400' : 'text-stone-500'}`}>
                    显示歌词
                  </span>
                  <button
                    onClick={() => setShowLyrics(!showLyrics)}
                    className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                      showLyrics 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30' 
                        : 'bg-stone-600 hover:bg-stone-500'
                    }`}
                  >
                    {/* 关闭状态图标 */}
                    <span className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showLyrics ? 'opacity-0' : 'opacity-100'}`}>
                      <span className="text-stone-400 text-xs">✕</span>
                    </span>
                    {/* 滑块 */}
                    <span
                      className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center ${
                        showLyrics ? 'translate-x-7' : 'translate-x-0.5'
                      }`}
                    >
                      {showLyrics && (
                        <span className="text-amber-500 text-xs">♪</span>
                      )}
                    </span>
                  </button>
                </label>
              </div>
              <CardDescription className="text-amber-200/60">
                格式：[时间]歌词 或 时间|歌词，例如：
                <br />[00:05] 第一句歌词
                <br />[00:10] 第二句歌词
                <br />纯文本将自动平均分配时间
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 歌曲名称 */}
              <div className="flex items-center gap-4 mb-3">
                <label className="text-amber-200/80 text-sm whitespace-nowrap">
                  歌曲名称：
                </label>
                <input
                  type="text"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  placeholder="输入歌曲名称"
                  className="flex-1 max-w-48 bg-stone-800/50 border border-stone-700/50 rounded px-3 py-1 text-amber-100 text-sm"
                />
              </div>

              {/* 字体样式 */}
              <div className="flex items-center gap-4 mb-3">
                <label className="text-amber-200/80 text-sm whitespace-nowrap">
                  字体样式：
                </label>
                <select
                  value={fontStyle}
                  onChange={(e) => setFontStyle(e.target.value as typeof fontStyle)}
                  className="bg-stone-800/50 border border-stone-700/50 rounded px-3 py-1 text-amber-100 text-sm"
                >
                  <option value="default">默认</option>
                  <option value="handwriting">手写体</option>
                  <option value="neon">霓虹发光</option>
                  <option value="retro">复古粗体</option>
                  <option value="modern">现代简约</option>
                  <option value="cute">可爱圆润</option>
                </select>
                <span className="text-amber-200/60 text-xs">
                  预览查看效果
                </span>
              </div>

              {/* 歌手名称 */}
              <div className="flex items-center gap-4 mb-3">
                <label className="text-amber-200/80 text-sm whitespace-nowrap">
                  歌手名称：
                </label>
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="输入歌手名称"
                  className="flex-1 max-w-48 bg-stone-800/50 border border-stone-700/50 rounded px-3 py-1 text-amber-100 text-sm"
                />
              </div>

              <div className="flex items-center gap-4 mb-3">
                <label className="text-amber-200/80 text-sm whitespace-nowrap">
                  歌词开始时间（跳过前奏）：
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={audioFile ? Math.floor(audioFile.duration - 10) : 300}
                    value={lyricsOffset}
                    onChange={(e) => setLyricsOffset(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 bg-stone-800/50 border border-stone-700/50 rounded px-2 py-1 text-amber-100 text-sm text-center"
                  />
                  <span className="text-amber-200/60 text-sm">秒</span>
                  <span className="text-amber-200/40 text-xs">
                    （例：前奏30秒则输入30）
                  </span>
                </div>
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={`[00:00] 谁在深夜里贪杯
[00:05] 落寞独自徘徊
[00:10] 思念如潮水涌来
[00:15] 往事如烟散开`}
                className="w-full h-40 bg-stone-800/50 border border-stone-700/50 rounded-lg p-3 text-amber-100 placeholder:text-amber-200/40 resize-none font-mono text-sm"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={generateTimeline}
                  disabled={!audioFile || !lyrics.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  自动生成时间轴
                </button>
                {audioFile && (
                  <span className="text-amber-200/60 text-sm self-center">
                    音频时长: {formatTime(audioFile.duration)}
                  </span>
                )}
              </div>
              {lyricsList.length > 0 && (
                <div className="mt-2 text-amber-200/60 text-sm">
                  已解析 {lyricsList.length} 句歌词 {lyricsOffset > 0 && `（从 ${lyricsOffset} 秒开始）`}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 预览区域 */}
          <Card className="bg-stone-900/80 border-amber-800/30 overflow-hidden">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-amber-100">视频预览</CardTitle>
                <CardDescription className="text-amber-200/60">
                  1080x1920 (9:16 竖屏)
                </CardDescription>
              </div>
              {audioFile && (
                <Button
                  onClick={togglePreview}
                  variant="outline"
                  className="border-amber-600 text-amber-400 hover:bg-amber-900/30"
                >
                  {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {isPlaying ? '暂停预览' : '预览效果'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex justify-center bg-stone-950 p-4">
              <div className="relative rounded-lg overflow-hidden shadow-2xl">
                {/* 预览 Canvas */}
                <canvas 
                  ref={canvasRef}
                  width={540}
                  height={960}
                  className="max-w-full"
                  style={{ maxHeight: '70vh' }}
                />
                {/* 隐藏的音频 */}
                {audioFile?.url && <audio ref={audioRef} src={audioFile.url} preload="metadata" />}
              </div>
            </CardContent>
          </Card>

          {/* 录制控制 */}
          <Card className="bg-stone-900/80 border-amber-800/30">
            <CardContent className="py-6">
              {recordedBlob ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-green-400">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-medium">视频录制完成！</span>
                  </div>
                  {!ffmpegLoaded && (
                    <div className="mb-4 p-3 bg-amber-900/30 border border-amber-600/50 rounded-lg text-sm text-amber-200">
                      <p className="font-medium mb-1">提示：</p>
                      <p>浏览器端 FFmpeg 加载失败，当前只能下载 WebM 格式。</p>
                      <p>如需 MP4 格式，建议：</p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        <li>使用云端部署版本（已包含 FFmpeg）</li>
                        <li>或下载后用 <a href="https://www.ffmpeg.org/download.html" target="_blank" rel="noopener" className="text-amber-400 underline hover:text-amber-300">FFmpeg</a> 命令转换：<code className="bg-black/30 px-1 rounded">ffmpeg -i input.webm output.mp4</code></li>
                      </ul>
                    </div>
                  )}
                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={downloadVideo}
                      size="lg"
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      下载视频 (WebM)
                    </Button>
                    <Button
                      onClick={() => recordedBlob && convertToMp4(recordedBlob)}
                      size="lg"
                      disabled={isConverting || !recordedBlob}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
                    >
                      {isConverting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          转换中 {convertProgress}%
                        </>
                      ) : (
                        <>
                          <FileVideo className="w-5 h-5 mr-2" />
                          下载视频 (MP4)
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setRecordedBlob(null)}
                      variant="outline"
                      size="lg"
                      className="border-amber-600 text-amber-400"
                    >
                      重新录制
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {isRecording ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 text-red-400">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="font-medium">正在录制...</span>
                        <span className="text-amber-200/60">{Math.floor(recordingProgress)}%</span>
                      </div>
                      <div className="w-full bg-stone-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-red-500 to-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${recordingProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Button
                          onClick={stopRecording}
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-900/30"
                        >
                          停止录制
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={startRecording}
                      disabled={!audioFile}
                      size="lg"
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50"
                    >
                      {audioFile ? (
                        <>
                          <Video className="w-5 h-5 mr-2" />
                          开始生成视频（{formatTime(audioFile.duration)}）
                        </>
                      ) : (
                        '请先上传音频文件'
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 提示 */}
          <Card className="bg-amber-900/20 border-amber-800/30">
            <CardContent className="py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-amber-200/70 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500" />
                  <span>9:16 竖屏</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500" />
                  <span>完整音频</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500" />
                  <span>歌词同步</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500" />
                  <span>抖音适配</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
