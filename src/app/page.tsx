import type { Metadata } from 'next';
import Link from 'next/link';
import { Music, Video, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '音乐视频生成器 - 抖音风格',
  description: '基于 AI 生成复古治愈系音乐视频，支持专辑封面、音频和歌词',
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-amber-900 to-stone-900">
      {/* 顶部装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-orange-600/15 rounded-full blur-3xl" />
      </div>

      <main className="relative container mx-auto px-4 py-20">
        {/* 头部 */}
        <header className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-900/30 rounded-full border border-amber-700/30 mb-6">
            <Music className="w-4 h-4 text-amber-400" />
            <span className="text-amber-200/80 text-sm">AI Music Video Generator</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-amber-50 mb-6">
            音乐视频生成器
          </h1>
          
          <p className="text-xl text-amber-200/60 max-w-2xl mx-auto mb-8">
            将你的专辑封面、音频和歌词，转化为抖音风格的复古治愈系音乐视频
          </p>

          <Link href="/music-video">
            <Button size="lg" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-lg px-8 h-14">
              <Video className="w-5 h-5 mr-2" />
              开始创作
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </header>

        {/* 风格展示 */}
        <section className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-amber-100 mb-8 text-center">视频风格特点</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* 风格卡片 1 */}
            <div className="bg-gradient-to-br from-amber-900/50 to-stone-900/50 rounded-2xl p-6 border border-amber-800/30 backdrop-blur-sm">
              <div className="w-14 h-14 bg-amber-600/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-amber-100 mb-2">复古暖色调</h3>
              <p className="text-amber-200/60 text-sm">温暖的棕褐色调搭配金色点缀，营造深夜治愈氛围</p>
            </div>

            {/* 风格卡片 2 */}
            <div className="bg-gradient-to-br from-amber-900/50 to-stone-900/50 rounded-2xl p-6 border border-amber-800/30 backdrop-blur-sm">
              <div className="w-14 h-14 bg-amber-600/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-amber-100 mb-2">黑胶唱片元素</h3>
              <p className="text-amber-200/60 text-sm">黑胶唱片、CD 视觉元素，怀旧质感触手可及</p>
            </div>

            {/* 风格卡片 3 */}
            <div className="bg-gradient-to-br from-amber-900/50 to-stone-900/50 rounded-2xl p-6 border border-amber-800/30 backdrop-blur-sm">
              <div className="w-14 h-14 bg-amber-600/20 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-amber-100 mb-2">抖音竖屏格式</h3>
              <p className="text-amber-200/60 text-sm">9:16 竖屏比例，完美适配抖音短视频平台</p>
            </div>
          </div>
        </section>

        {/* 使用流程 */}
        <section className="max-w-4xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-amber-100 mb-8 text-center">快速开始</h2>
          
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">1</div>
              <p className="text-amber-200 text-sm">上传专辑封面</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">2</div>
              <p className="text-amber-200 text-sm">添加音频文件</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">3</div>
              <p className="text-amber-200 text-sm">输入歌词（可选）</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">4</div>
              <p className="text-amber-200 text-sm">生成并下载</p>
            </div>
          </div>
        </section>

        {/* 参考风格展示 */}
        <section className="max-w-2xl mx-auto mt-16">
          <div className="bg-gradient-to-br from-amber-900/40 to-stone-900/40 rounded-2xl p-8 border border-amber-700/30">
            <h3 className="text-lg font-semibold text-amber-100 mb-4 text-center">参考风格</h3>
            <div className="aspect-[9/16] max-w-xs mx-auto bg-gradient-to-br from-amber-800 via-stone-800 to-amber-900 rounded-xl overflow-hidden border border-amber-700/30 shadow-2xl">
              {/* 模拟播放器界面 */}
              <div className="h-full flex flex-col p-6">
                {/* 标题区域 */}
                <div className="text-center mb-4">
                  <h4 className="text-white text-xl font-semibold">余生有你</h4>
                  <p className="text-amber-200/50 text-sm">— 就很美 —</p>
                </div>

                {/* 唱片区域 */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    {/* 专辑封面 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-amber-900 rounded-lg shadow-xl overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-amber-200/30 text-xs">封面图</p>
                        </div>
                      </div>
                    </div>
                    {/* 黑胶唱片叠加 */}
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2 w-32 h-32 bg-stone-900 rounded-full shadow-2xl border-4 border-amber-600/30">
                      <div className="absolute inset-4 bg-gradient-to-br from-amber-700 to-stone-800 rounded-full">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-amber-600 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 歌词区域 */}
                <div className="mt-auto text-center">
                  <p className="text-white text-lg font-medium mb-4">谁在深夜里贪杯</p>
                  
                  {/* 进度条 */}
                  <div className="w-full bg-stone-700 rounded-full h-1 mb-2">
                    <div className="bg-amber-500 h-1 rounded-full w-1/3" />
                  </div>
                  <div className="flex justify-between text-amber-200/40 text-xs">
                    <span>00:30</span>
                    <span>03:45</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-amber-200/50 text-sm text-center mt-4">
              复古音乐播放器风格
            </p>
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-amber-800/30 bg-black/20 mt-20">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-amber-200/40 text-sm">
            Music Video Generator - 复古治愈系风格 · 适配抖音平台
          </p>
        </div>
      </footer>
    </div>
  );
}
