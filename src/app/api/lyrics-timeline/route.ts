import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const lyricsText = formData.get('lyrics') as string;

    if (!audioFile) {
      return NextResponse.json({ error: '请上传音频文件' }, { status: 400 });
    }

    if (!lyricsText || lyricsText.trim() === '') {
      return NextResponse.json({ error: '请输入歌词' }, { status: 400 });
    }

    // 获取音频时长
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    await audioContext.close();

    // 解析歌词行
    const lines = lyricsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // 过滤掉空行和非歌词内容（如时间码等）
    const filteredLines = lines.filter(line => {
      // 跳过纯数字或时间码格式的行
      if (/^\d+$/.test(line)) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(line)) return false;
      if (/^<\d{2}:\d{2}>/.test(line)) return false;
      return true;
    });

    if (filteredLines.length === 0) {
      return NextResponse.json({ error: '未能解析出有效歌词' }, { status: 400 });
    }

    // 计算每句歌词的时间
    const avgDuration = duration / filteredLines.length;
    const lyricsWithTime: { time: number; text: string }[] = [];

    filteredLines.forEach((line, index) => {
      const time = Math.floor(index * avgDuration);
      lyricsWithTime.push({
        time,
        text: line
      });
    });

    // 转换为 [00:00] 格式
    const formattedLyrics = lyricsWithTime
      .map(item => {
        const minutes = Math.floor(item.time / 60);
        const seconds = item.time % 60;
        const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        return `[${timeStr}] ${item.text}`;
      })
      .join('\n');

    return NextResponse.json({
      success: true,
      duration: Math.round(duration),
      durationFormatted: formatTime(duration),
      lyricsCount: filteredLines.length,
      formattedLyrics
    });

  } catch (error) {
    console.error('歌词时间轴生成失败:', error);
    return NextResponse.json(
      { error: '处理失败，请确保音频格式正确' },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
