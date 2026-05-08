import { NextRequest, NextResponse } from 'next/server';
import { HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 简单的文件上传 API
 * 支持图片和音频文件
 * 返回可以直接访问的 URL
 */

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '没有上传文件' },
        { status: 400 }
      );
    }

    // 检查文件类型
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg'];
    
    const isImage = allowedImageTypes.includes(file.type);
    const isAudio = allowedAudioTypes.includes(file.type);

    if (!isImage && !isAudio) {
      return NextResponse.json(
        { error: '不支持的文件类型，请上传图片（JPG/PNG/WebP）或音频（MP3/WAV/M4A）' },
        { status: 400 }
      );
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 生成唯一的文件名
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || (isImage ? 'jpg' : 'mp3');
    const filename = `${isImage ? 'image' : 'audio'}_${timestamp}_${random}.${ext}`;

    // 注意：这里需要使用对象存储
    // 由于环境变量可能包含存储配置，我们可以尝试使用 SDK 的能力
    // 但在这个简单实现中，我们直接返回 base64 或临时 URL
    
    // 如果是开发环境，可以直接返回 base64
    const base64 = buffer.toString('base64');
    const mimeType = file.type;
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // 在实际生产环境中，应该上传到对象存储
    // 这里返回一个可以直接使用的数据 URL（适用于小文件）
    console.log(`[Upload] 文件上传: ${filename}, 大小: ${buffer.length} bytes, 类型: ${file.type}`);

    return NextResponse.json({
      success: true,
      url: dataUrl,
      filename: filename,
      size: buffer.length,
      type: file.type,
      isImage,
      isAudio,
    });

  } catch (error) {
    console.error('[Upload] 错误:', error);
    
    return NextResponse.json(
      { error: '文件上传失败，请稍后重试' },
      { status: 500 }
    );
  }
}
