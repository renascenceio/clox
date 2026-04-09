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
    <div className="min-h-screen bg-gradient-to-br from-surface-secondary via-white to-surface-secondary text-label-primary font-sans selection:bg-teal/20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-20 glass-float z-50 mx-6 mt-6 rounded-hig-2xl shadow-float">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 gradient-brown-teal rounded-hig-lg flex items-center justify-center shadow-brown-glow group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">Clox Studio</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
            <Link href="#models" className="hover:text-brown transition-colors">Models</Link>
            <Link href="#features" className="hover:text-teal transition-colors">Features</Link>
            <Link href="/text" className="px-6 py-3 bg-brown text-white rounded-hig-xl hover:bg-brown-700 transition-all shadow-brown-glow hover:shadow-hig-hover hover:scale-105 active:scale-95">
              Launch Studio
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-48 pb-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-brown-200 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-teal-200 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-5xl mx-auto text-center space-y-10 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brown-50 border border-brown-200 rounded-full text-sm font-semibold text-brown-700 mb-4">
              <span className="w-2 h-2 bg-brown-500 rounded-full animate-pulse" />
              80+ AI models, one unified workspace
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[1.05] text-balance">
              The Complete AI <br />
              <span className="bg-gradient-to-r from-brown-500 via-brown-600 to-teal-500 bg-clip-text text-transparent">Creation Studio</span>
            </h1>
            
            <p className="text-2xl text-label-secondary max-w-3xl mx-auto leading-relaxed text-pretty">
              Generate text, images, video, and audio with the world&apos;s most powerful AI models—including Chinese AI leaders like DeepSeek, Qwen, and Kimi.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-4">
              <Link 
                href="/text" 
                className="w-full sm:w-auto px-10 py-5 gradient-brown-teal text-white rounded-hig-2xl text-lg font-bold shadow-float hover:shadow-float-lg hover:scale-105 active:scale-95 transition-all"
              >
                Start Creating Free
              </Link>
              <Link 
                href="#models" 
                className="w-full sm:w-auto px-10 py-5 glass-float rounded-hig-2xl text-lg font-bold hover:bg-white transition-all"
              >
                Explore Models
              </Link>
            </div>
            
            <div className="pt-8 flex items-center justify-center gap-8 text-sm text-label-tertiary">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                No credit card
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                Free tier included
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-success rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                Cancel anytime
              </div>
            </div>
          </div>
        </section>

        {/* Model Categories Grid */}
        <section id="models" className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-4 text-balance">Four creative modes. <br />Infinite possibilities.</h2>
            <p className="text-xl text-label-secondary text-pretty">Access the best AI models from every major provider</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Text Generation Card */}
            <Link href="/text" className="group bg-brown-600 p-10 rounded-hig-3xl border border-brown-700 shadow-float hover:shadow-float-lg transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brown-500/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brown-700/50 backdrop-blur-sm rounded-full text-xs font-bold text-brown-100 mb-4">
                  TEXT GENERATION
                </div>
                <h3 className="text-4xl font-bold text-white mb-4">Intelligent Writing</h3>
                <p className="text-brown-100 text-lg leading-relaxed mb-6">
                  GPT-5, Claude Opus 4.6, Gemini 3 Flash, DeepSeek V4, Qwen 3.5—the most advanced language models.
                </p>
                <div className="flex items-center gap-2 text-brown-200 text-sm font-semibold group-hover:gap-3 transition-all">
                  <span>30+ models available</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Image Generation Card */}
            <Link href="/image" className="group bg-teal-600 p-10 rounded-hig-3xl border border-teal-700 shadow-float hover:shadow-float-lg transition-all relative overflow-hidden">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-700/50 backdrop-blur-sm rounded-full text-xs font-bold text-teal-100 mb-4">
                  IMAGE GENERATION
                </div>
                <h3 className="text-4xl font-bold text-white mb-4">Visual Creation</h3>
                <p className="text-teal-100 text-lg leading-relaxed mb-6">
                  DALL-E 4, Midjourney v7, Stable Diffusion XL, Ideogram 3.0—photorealistic and artistic imagery.
                </p>
                <div className="flex items-center gap-2 text-teal-200 text-sm font-semibold group-hover:gap-3 transition-all">
                  <span>20+ models available</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Video Generation Card */}
            <Link href="/video" className="group bg-brown-700 p-10 rounded-hig-3xl border border-brown-800 shadow-float hover:shadow-float-lg transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 w-64 h-64 bg-brown-600/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-brown-800/50 backdrop-blur-sm rounded-full text-xs font-bold text-brown-100 mb-4">
                  VIDEO GENERATION
                </div>
                <h3 className="text-4xl font-bold text-white mb-4">Motion & Film</h3>
                <p className="text-brown-100 text-lg leading-relaxed mb-6">
                  Sora, Runway Gen-4, Kling 2.0, Luma Dream Machine—cinematic AI video generation.
                </p>
                <div className="flex items-center gap-2 text-brown-200 text-sm font-semibold group-hover:gap-3 transition-all">
                  <span>15+ models available</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Audio Generation Card */}
            <Link href="/audio" className="group bg-teal-700 p-10 rounded-hig-3xl border border-teal-800 shadow-float hover:shadow-float-lg transition-all relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-600/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-800/50 backdrop-blur-sm rounded-full text-xs font-bold text-teal-100 mb-4">
                  AUDIO GENERATION
                </div>
                <h3 className="text-4xl font-bold text-white mb-4">Sound & Voice</h3>
                <p className="text-teal-100 text-lg leading-relaxed mb-6">
                  ElevenLabs, MusicLM, Suno v4, Udio—ultra-realistic voice cloning and music generation.
                </p>
                <div className="flex items-center gap-2 text-teal-200 text-sm font-semibold group-hover:gap-3 transition-all">
                  <span>15+ models available</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 bg-gradient-to-b from-surface-tertiary to-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-bold mb-4">Built for creators who demand excellence</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  title: "Unified Interface", 
                  desc: "Switch between text, image, video, and audio generation seamlessly. One workspace for everything.",
                  color: "brown"
                },
                { 
                  title: "Model Comparison", 
                  desc: "Run the same prompt across multiple AI models simultaneously to find the perfect output.",
                  color: "teal"
                },
                { 
                  title: "Project Organization", 
                  desc: "Organize your generations into folders, add tags, and build a searchable creative library.",
                  color: "brown"
                },
                { 
                  title: "Advanced Controls", 
                  desc: "Fine-tune aspect ratios, quality, style, duration, and model-specific parameters with precision.",
                  color: "teal"
                },
                { 
                  title: "Global AI Access", 
                  desc: "Access Western and Chinese AI models—DeepSeek, Qwen, Kimi, GLM alongside GPT and Claude.",
                  color: "brown"
                },
                { 
                  title: "Export Anywhere", 
                  desc: "Download outputs in multiple formats, share links, or push directly to your favorite tools.",
                  color: "teal"
                },
              ].map((feature) => (
                <div 
                  key={feature.title} 
                  className={`glass-float p-8 rounded-hig-2xl hover:shadow-float transition-all group ${
                    feature.color === 'brown' ? 'hover:border-brown-200' : 'hover:border-teal-200'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-hig-lg mb-6 flex items-center justify-center ${
                    feature.color === 'brown' ? 'bg-brown-100' : 'bg-teal-100'
                  }`}>
                    <div className={`w-6 h-6 rounded ${
                      feature.color === 'brown' ? 'bg-brown-500' : 'bg-teal-500'
                    }`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-label-secondary leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full gradient-brown-teal" />
          </div>
          
          <div className="max-w-4xl mx-auto text-center relative z-10 space-y-8">
            <h2 className="text-6xl font-bold text-balance">
              Ready to create with the world&apos;s best AI?
            </h2>
            <p className="text-2xl text-label-secondary text-pretty">
              Join thousands of creators using Clox Studio to bring their ideas to life.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6">
              <Link 
                href="/text" 
                className="w-full sm:w-auto px-12 py-6 gradient-brown-teal text-white rounded-hig-2xl text-xl font-bold shadow-float-lg hover:scale-105 active:scale-95 transition-all"
              >
                Launch Studio
              </Link>
              <Link 
                href="#models" 
                className="w-full sm:w-auto px-12 py-6 glass-float rounded-hig-2xl text-xl font-bold hover:bg-white transition-all"
              >
                View All Models
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-16 px-6 border-t border-separator glass-float mx-6 mb-6 rounded-hig-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 gradient-brown-teal rounded-hig-lg flex items-center justify-center shadow-brown-glow group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="font-bold text-2xl tracking-tight">Clox Studio</span>
          </Link>
          <div className="text-sm text-label-secondary">
            © {new Date().getFullYear()} Clox Studio. Powered by 80+ AI models.
          </div>
        </div>
      </footer>
    </div>
  )
}
