import { NextRequest, NextResponse } from 'next/server';
import {
  VideoEditClient,
  Config,
  HeaderUtils,
  SubtitleConfig,
  TextItem
} from 'coze-coding-dev-sdk';

/**
 * 音视频合成 API
 * 将视频与音频合并，生成最终的抖音音乐视频
 */

interface LyricLine {
  text: string;
  startTime: number;
  endTime: number;
}

interface CompileRequest {
  videoUrl: string;         // 视频 URL
  audioUrl: string;         // 音频 URL
  lyrics?: LyricLine[];     // 歌词（带时间戳）
  keepOriginalAudio?: boolean; // 是否保留原始音频
}

export async function POST(request: NextRequest) {
  try {
    const body: CompileRequest = await request.json();
    const { videoUrl, audioUrl, lyrics, keepOriginalAudio = false } = body;

    // 参数验证
    if (!videoUrl || !audioUrl) {
      return NextResponse.json(
        { error: '缺少必要的参数：videoUrl 和 audioUrl 是必需的' },
        { status: 400 }
      );
    }

    // 提取请求头用于 SDK
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new VideoEditClient(config, customHeaders);

    console.log(`[Audio Compile] 开始合成音视频...`);
    console.log(`- 视频: ${videoUrl}`);
    console.log(`- 音频: ${audioUrl}`);

    // 先合成音视频
    const compileResponse = await client.compileVideoAudio(
      videoUrl,
      audioUrl,
      {
        isAudioReserve: keepOriginalAudio,
        isVideoAudioSync: true,
      }
    );

    let finalUrl = compileResponse.url;
    console.log(`[Audio Compile] 音视频合成完成: ${finalUrl}`);

    // 如果有歌词，添加字幕
    if (lyrics && lyrics.length > 0) {
      console.log(`[Audio Compile] 添加歌词字幕...`);
      
      const subtitleConfig: SubtitleConfig = {
        font_pos_config: {
          pos_x: '0',
          pos_y: '85%',
          width: '100%',
          height: '15%',
        },
        font_size: 36,
        font_color: '#FFFFFFFF',
        font_type: '1525745',
        background_color: '#00000066',
        background_border_width: 4,
        border_width: 1,
        border_color: '#00000088',
      };

      const textItems: TextItem[] = lyrics.map(line => ({
        start_time: line.startTime,
        end_time: line.endTime,
        text: line.text
      }));

      const subtitleResponse = await client.addSubtitles(
        finalUrl,
        subtitleConfig,
        { textList: textItems }
      );

      if (subtitleResponse.url) {
        finalUrl = subtitleResponse.url;
        console.log(`[Audio Compile] 字幕添加完成`);
      }
    }

    return NextResponse.json({
      success: true,
      videoUrl: finalUrl,
      videoMeta: compileResponse.video_meta,
    });

  } catch (error) {
    console.error('[Audio Compile] 错误:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: `音视频合成失败: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: '音视频合成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
