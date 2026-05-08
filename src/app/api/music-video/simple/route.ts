import { NextRequest, NextResponse } from 'next/server';
import {
  VideoGenerationClient,
  Config,
  HeaderUtils,
  Content
} from 'coze-coding-dev-sdk';

/**
 * 简单版音乐视频生成 API
 * 使用用户提供的单张图片作为首帧，快速生成短视频
 * 适用于简单场景或测试
 */

interface SimpleGenerationRequest {
  imageUrl: string;        // 专辑封面图片 URL
  audioUrl: string;         // 音频文件 URL
  lyrics?: string;          // 歌词文本（简单格式，每行一句）
  title?: string;           // 可选的标题
  prompt?: string;          // 自定义提示词
  duration?: number;        // 视频时长 (4-12秒)
}

// 解析简单歌词格式
function parseSimpleLyrics(lyricsText: string): { text: string; startTime: number; endTime: number }[] {
  const lines = lyricsText.split('\n').filter(line => line.trim());
  const duration = 5; // 默认每句 5 秒
  return lines.map((text, index) => ({
    text: text.trim(),
    startTime: index * duration,
    endTime: (index + 1) * duration
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body: SimpleGenerationRequest = await request.json();
    const { imageUrl, audioUrl, lyrics, title, prompt, duration = 5 } = body;

    // 参数验证
    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少必要的参数：imageUrl 是必需的' },
        { status: 400 }
      );
    }

    // 提取请求头用于 SDK
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new VideoGenerationClient(config, customHeaders);

    // 处理歌词
    const lyricsList = lyrics ? parseSimpleLyrics(lyrics) : [];
    const lyricText = lyricsList.length > 0 
      ? lyricsList.map(l => l.text).join('. ') 
      : '';

    // 构建提示词
    const stylePrompt = prompt || [
      'warm vintage aesthetic',
      'soft brown tones with golden highlights',
      'cozy nighttime atmosphere',
      'melancholic yet healing mood',
      'gentle light glow effects',
      'dreamy nostalgic vinyl record player style'
    ].join(', ');

    const finalPrompt = lyricText 
      ? `${stylePrompt}. Lyrics: ${lyricText}` 
      : stylePrompt;

    console.log(`[Simple Music Video] 生成视频...`);
    console.log(`- 时长: ${duration}秒`);
    console.log(`- 提示词: ${finalPrompt}`);

    // 生成视频
    const contentItems: Content[] = [
      {
        type: 'image_url' as const,
        image_url: { url: imageUrl },
        role: 'first_frame' as const,
      },
      {
        type: 'text' as const,
        text: finalPrompt,
      }
    ];

    const response = await client.videoGeneration(contentItems, {
      model: 'doubao-seedance-1-5-pro-251215',
      duration: Math.min(Math.max(duration, 4), 12), // 限制在 4-12 秒
      ratio: '9:16',           // 抖音竖屏格式
      resolution: '720p',
      generateAudio: false,    // 使用用户提供的音频
      watermark: false,
    });

    if (!response.videoUrl) {
      return NextResponse.json(
        { error: '视频生成失败，请稍后重试' },
        { status: 500 }
      );
    }

    console.log(`[Simple Music Video] 视频生成成功: ${response.videoUrl}`);

    // 如果提供了音频，合成音频（这里需要调用 VideoEditClient）
    // 由于简单版主要关注视频生成，音频合成分离到另一个 API
    return NextResponse.json({
      success: true,
      videoUrl: response.videoUrl,
      prompt: finalPrompt,
      duration: duration,
    });

  } catch (error) {
    console.error('[Simple Music Video] 错误:', error);
    
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
