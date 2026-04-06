import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Clox Studio – AI Aggregator Portal",
  description: "Generate text, images, video, and audio with 50+ AI models in one unified workspace.",
  openGraph: {
    images: ["https://picsum.photos/seed/clox-og/1200/630"],
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F2F2F7] text-[#1C1C1E] font-sans selection:bg-[#5856D6]/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-[#E5E5EA] z-50">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#5856D6] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Clox Studio</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="#features" className="hover:text-[#5856D6] transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-[#5856D6] transition-colors">Pricing</Link>
            <Link href="/login" className="px-4 py-2 bg-[#5856D6] text-white rounded-full hover:bg-[#3634A3] transition-colors">Get Started</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
              The world&apos;s leading AI models. <br />
              <span className="text-[#5856D6]">All in one place.</span>
            </h1>
            <p className="text-xl text-[#636366] max-w-2xl mx-auto leading-relaxed">
              Generate text, images, video, and audio using OpenAI, Anthropic, Google, and 50+ other providers from a single, polished workspace.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="w-full sm:w-auto px-8 py-4 bg-[#5856D6] text-white rounded-2xl text-lg font-bold hover:bg-[#3634A3] transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                Start Generating for Free
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-white border border-[#E5E5EA] rounded-2xl text-lg font-bold hover:bg-[#F2F2F7] transition-all">
                Enter Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: "Text Generation", desc: "GPT-4o, Claude 3.5, Gemini 1.5. Infinite creative possibilities.", icon: "✍️" },
            { title: "Image Generation", desc: "DALL-E 3, Stable Diffusion XL, Midjourney. Photorealistic art.", icon: "🎨" },
            { title: "Video Motion", desc: "Sora, Runway Gen-3, Kling. Bring your ideas to life.", icon: "🎬" },
            { title: "Audio & Voice", desc: "ElevenLabs, MusicLM, Suno. Studio-quality sound.", icon: "🔊" },
          ].map((f) => (
            <div key={f.title} className="bg-white p-8 rounded-[20px] border border-[#E5E5EA] shadow-sm hover:shadow-md transition-shadow group">
              <div className="text-4xl mb-6 group-hover:scale-110 transition-transform inline-block">{f.icon}</div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="text-[#636366] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Preview Section */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto bg-white rounded-[32px] border border-[#E5E5EA] shadow-2xl overflow-hidden aspect-video relative group">
            <Image
              src="https://picsum.photos/seed/clox-preview/1200/800"
              alt="Clox Studio Workspace"
              fill
              className="object-cover group-hover:scale-[1.01] transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-12">
               <div className="text-white space-y-2">
                  <h2 className="text-3xl font-bold">Unified AI Workspace</h2>
                  <p className="text-white/80 max-w-lg">Switch models instantly, save outputs to your gallery, and organize your work into projects.</p>
               </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-20 px-6 border-t border-[#E5E5EA] bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#5856D6] rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Clox Studio</span>
          </Link>
          <div className="text-sm text-[#636366]">
            © 2025 Clox Studio. Built following Apple Human Interface Guidelines.
          </div>
        </div>
      </footer>
    </div>
  )
}
