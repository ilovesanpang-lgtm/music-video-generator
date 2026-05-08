import { NextRequest, NextResponse } from 'next/server';
import {
  VideoGenerationClient,
  VideoEditClient,
  Config,
  HeaderUtils,
  SubtitleConfig,
  TextItem,
  Content
} from 'coze-coding-dev-sdk';

/**
 * 音乐视频生成工作流 API
 * 
 * 工作流程：
 * 1. 接收用户上传的图片、音频和歌词
 * 2. 将音频与图片结合生成视频片段
 * 3. 拼接所有视频片段
 * 4. 添加歌词字幕
 * 5. 返回最终视频 URL
 */

interface LyricLine {
  text: string;
  startTime: number; // 秒
  endTime: number;   // 秒
}

interface GenerationRequest {
  imageUrl: string;        // 专辑封面图片 URL
  audioUrl: string;        // 音频文件 URL
  lyrics: LyricLine[];      // 歌词（带时间戳）
  title?: string;           // 可选的标题
  duration?: number;        // 视频总时长（秒）
}

// 解析 LRC 格式歌词
function parseLRC(lrcContent: string): LyricLine[] {
  const lyrics: LyricLine[] = [];
  const lines = lrcContent.split('\n');
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3].padEnd(3, '0'), 10);
      const startTime = minutes * 60 + seconds + ms / 1000;
      const text = line.replace(timeRegex, '').trim();
      
      if (text) {
        // 设置每句持续时间（与下一句开始时间的间隔）
        if (lyrics.length > 0) {
          lyrics[lyrics.length - 1].endTime = startTime;
        }
        lyrics.push({ text, startTime, endTime: startTime + 10 });
      }
      // 设置最后一局的结束时间
      if (lyrics.length > 0 && !lyrics[lyrics.length - 1].endTime) {
        lyrics[lyrics.length - 1].endTime = startTime + 5;
      }
    }
  }
  
  return lyrics;
}

// 将歌词转换为 TextItem 格式
function lyricsToTextItems(lyrics: LyricLine[]): TextItem[] {
  return lyrics.map(line => ({
    start_time: line.startTime,
    end_time: line.endTime,
    text: line.text
  }));
}

// 生成复古治愈系风格的视频提示词
function generateStylePrompt(title?: string): string {
  const styleElements = [
    'warm vintage aesthetic',
    'soft brown tones with golden highlights',
    'cozy nighttime atmosphere',
    'melancholic yet healing mood',
    'gentle light glow effects',
    'dreamy and nostalgic feeling'
  ];
  
  const basePrompt = styleElements.join(', ');
  return title 
    ? `${basePrompt}, featuring: ${title}` 
    : basePrompt;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerationRequest = await request.json();
    const { imageUrl, audioUrl, lyrics, title } = body;

    // 参数验证
    if (!imageUrl || !audioUrl) {
      return NextResponse.json(
        { error: '缺少必要的参数：imageUrl 和 audioUrl 是必需的' },
        { status: 400 }
      );
    }

    // 提取请求头用于 SDK
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const videoGenClient = new VideoGenerationClient(config, customHeaders);
    const videoEditClient = new VideoEditClient(config, customHeaders);

    // 处理歌词
    const processedLyrics = lyrics && lyrics.length > 0 
      ? lyrics 
      : [{ text: title || 'Music Video', startTime: 0, endTime: 10 }];

    // 生成风格化的提示词
    const stylePrompt = generateStylePrompt(title);

    // 计算需要生成的视频片段数量
    const totalDuration = processedLyrics.reduce((max, lyric) => 
      Math.max(max, lyric.endTime), 10);
    const clipDuration = 5; // 每个片段 5 秒
    const clipCount = Math.ceil(totalDuration / clipDuration);

    console.log(`[Music Video Workflow] 开始生成视频...`);
    console.log(`- 总时长: ${totalDuration}秒`);
    console.log(`- 片段数量: ${clipCount}`);
    console.log(`- 歌词数量: ${processedLyrics.length}`);

    // 生成多个视频片段
    const videoClips: string[] = [];
    let lastFrameUrl: string | null = null;

    for (let i = 0; i < clipCount; i++) {
      const startTime = i * clipDuration;
      const endTime = Math.min((i + 1) * clipDuration, totalDuration);
      const clipDurationActual = endTime - startTime;

      // 找到该片段对应的歌词
      const clipLyrics = processedLyrics.filter(
        lyric => lyric.startTime < endTime && lyric.endTime > startTime
      );
      const lyricText = clipLyrics.length > 0 
        ? clipLyrics.map(l => l.text).join(' ') 
        : '';

      // 构建视频生成内容
      const contentItems: Content[] = [
        {
          type: 'image_url' as const,
          image_url: { url: imageUrl },
          role: 'first_frame' as const,
        }
      ];

      // 如果有上一段的最后一帧，添加到内容中
      if (lastFrameUrl) {
        contentItems.push({
          type: 'image_url' as const,
          image_url: { url: lastFrameUrl },
          role: 'last_frame' as const,
        });
      }

      // 添加风格提示词
      const prompt = lyricText 
        ? `${stylePrompt}, ${lyricText}` 
        : stylePrompt;

      contentItems.push({
        type: 'text' as const,
        text: prompt,
      });

      console.log(`[Music Video Workflow] 生成片段 ${i + 1}/${clipCount}...`);

      // 生成视频片段（不使用自动音频，使用用户提供的音频）
      const response = await videoGenClient.videoGeneration(contentItems, {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: clipDurationActual,
        ratio: '9:16',           // 抖音竖屏格式
        resolution: '720p',
        generateAudio: false,    // 使用用户提供的音频
        returnLastFrame: true,
        watermark: false,
      });

      if (response.videoUrl) {
        videoClips.push(response.videoUrl);
        lastFrameUrl = response.lastFrameUrl;
        console.log(`[Music Video Workflow] 片段 ${i + 1} 生成成功: ${response.videoUrl}`);
      } else {
        console.error(`[Music Video Workflow] 片段 ${i + 1} 生成失败`);
      }
    }

    // 如果只有一个片段，直接使用
    let finalVideoUrl: string;
    
    if (videoClips.length === 0) {
      return NextResponse.json(
        { error: '视频片段生成失败' },
        { status: 500 }
      );
    } else if (videoClips.length === 1) {
      finalVideoUrl = videoClips[0];
    } else {
      // 拼接多个视频片段
      console.log(`[Music Video Workflow] 拼接 ${videoClips.length} 个视频片段...`);
      const concatResponse = await videoEditClient.concatVideos(videoClips);
      finalVideoUrl = concatResponse.url;
      console.log(`[Music Video Workflow] 视频拼接完成: ${finalVideoUrl}`);
    }

    // 添加歌词字幕
    console.log(`[Music Video Workflow] 添加歌词字幕...`);
    const subtitleConfig: SubtitleConfig = {
      font_pos_config: {
        pos_x: '0',
        pos_y: '85%',  // 底部位置，适合竖屏
        width: '100%',
        height: '15%',
      },
      font_size: 36,
      font_color: '#FFFFFFFF',  // 白色
      font_type: '1525745',     // 默认字体
      background_color: '#00000066',  // 半透明黑色背景
      background_border_width: 4,
      border_width: 1,
      border_color: '#00000088',
    };

    const textItems = lyricsToTextItems(processedLyrics);
    const subtitleResponse = await videoEditClient.addSubtitles(
      finalVideoUrl,
      subtitleConfig,
      { textList: textItems }
    );

    if (subtitleResponse.url) {
      finalVideoUrl = subtitleResponse.url;
      console.log(`[Music Video Workflow] 字幕添加完成`);
    }

    // 合成最终音频
    console.log(`[Music Video Workflow] 合成音频...`);
    const audioResponse = await videoEditClient.compileVideoAudio(
      finalVideoUrl,
      audioUrl,
      {
        isAudioReserve: false,  // 移除原始音频
        isVideoAudioSync: true,
      }
    );

    const finalUrl = audioResponse.url || finalVideoUrl;
    console.log(`[Music Video Workflow] 视频生成完成: ${finalUrl}`);

    return NextResponse.json({
      success: true,
      videoUrl: finalUrl,
      videoMeta: audioResponse.video_meta,
      duration: totalDuration,
      clipCount: videoClips.length,
    });

  } catch (error) {
    console.error('[Music Video Workflow] 错误:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `视频生成失败: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: '视频生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
