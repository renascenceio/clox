'use client'

import { useState } from 'react'

interface Model {
  id: string
  name: string
  provider: string
  category?: string
}

interface SelectOption {
  label: string
  value: string | number
}

interface UnifiedControlsPanelProps {
  type: 'text' | 'image' | 'video' | 'audio'
  models: Model[]
  selectedModel: Model
  onModelChange: (model: Model) => void
  
  // Common controls
  aspectRatios?: SelectOption[]
  selectedAspectRatio?: string
  onAspectRatioChange?: (ratio: string) => void
  
  qualityLevels?: SelectOption[]
  selectedQuality?: string
  onQualityChange?: (quality: string) => void
  
  stylePresets?: SelectOption[]
  selectedStyle?: string
  onStyleChange?: (style: string) => void
  
  durations?: SelectOption[]
  selectedDuration?: number
  onDurationChange?: (duration: number) => void
}

export default function UnifiedControlsPanel({
  type,
  models,
  selectedModel,
  onModelChange,
  aspectRatios,
  selectedAspectRatio,
  onAspectRatioChange,
  qualityLevels,
  selectedQuality,
  onQualityChange,
  stylePresets,
  selectedStyle,
  onStyleChange,
  durations,
  selectedDuration,
  onDurationChange,
}: UnifiedControlsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  
  const categories = ['all', ...Array.from(new Set(models.map(m => m.category || 'Other')))]
  const filteredModels = activeCategory === 'all' 
    ? models 
    : models.filter(m => m.category === activeCategory)

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="p-6 border-b border-separator/50">
        <h2 className="text-lg font-bold text-label-primary mb-1">
          {type.charAt(0).toUpperCase() + type.slice(1)} Settings
        </h2>
        <p className="text-xs text-label-tertiary">
          Configure your generation parameters
        </p>
      </div>

      {/* Scrollable Controls */}
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-8">
        {/* Model Selection */}
        <div className="space-y-4">
          <label className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">
            AI Model
          </label>
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-hig-md text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-brown text-white shadow-brown-glow'
                    : 'bg-surface-secondary text-label-secondary hover:bg-fill border border-separator/50'
                }`}
              >
                {cat === 'all' ? 'All Models' : cat}
              </button>
            ))}
          </div>
          
          {/* Model Dropdown */}
          <select
            value={selectedModel.id}
            onChange={(e) => onModelChange(filteredModels.find(m => m.id === e.target.value)!)}
            className="w-full h-11 px-4 bg-fill border border-separator/30 rounded-hig-lg text-sm font-medium focus:ring-2 focus:ring-brown/20 focus:border-brown/30 outline-none transition-all"
          >
            {filteredModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} • {model.provider}
              </option>
            ))}
          </select>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-brown-50 border border-brown-200 rounded-hig-lg">
            <div className="w-2 h-2 bg-brown rounded-full"></div>
            <span className="text-xs text-brown-700 font-semibold">
              {selectedModel.provider}
            </span>
          </div>
        </div>

        {/* Aspect Ratio - Image & Video */}
        {aspectRatios && onAspectRatioChange && (
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-2 gap-2">
              {aspectRatios.map(ratio => (
                <button
                  key={ratio.value}
                  onClick={() => onAspectRatioChange(ratio.value as string)}
                  className={`h-11 rounded-hig-lg border text-xs font-semibold flex items-center justify-center transition-all ${
                    selectedAspectRatio === ratio.value
                      ? 'bg-teal-50 border-teal-500 text-teal-700 shadow-teal-glow'
                      : 'bg-surface border-separator hover:border-teal-300 hover:bg-teal-50/50'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quality */}
        {qualityLevels && onQualityChange && (
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">
              Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {qualityLevels.map(quality => (
                <button
                  key={quality.value}
                  onClick={() => onQualityChange(quality.value as string)}
                  className={`h-11 rounded-hig-lg border text-xs font-semibold transition-all ${
                    selectedQuality === quality.value
                      ? 'bg-brown-50 border-brown-500 text-brown-700 shadow-brown-glow'
                      : 'bg-surface border-separator hover:border-brown-300 hover:bg-brown-50/50'
                  }`}
                >
                  {quality.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Style Presets - Image */}
        {stylePresets && onStyleChange && (
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">
              Style Preset
            </label>
            <div className="grid grid-cols-2 gap-2">
              {stylePresets.map(style => (
                <button
                  key={style.value}
                  onClick={() => onStyleChange(style.value as string)}
                  className={`h-10 rounded-hig-lg border text-xs font-semibold transition-all ${
                    selectedStyle === style.value
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'bg-surface border-separator hover:border-teal-300'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Duration - Video & Audio */}
        {durations && onDurationChange && (
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-label-secondary uppercase tracking-widest">
              Duration
            </label>
            <div className="grid grid-cols-2 gap-2">
              {durations.map(duration => (
                <button
                  key={duration.value}
                  onClick={() => onDurationChange(duration.value as number)}
                  className={`h-11 rounded-hig-lg border text-xs font-semibold transition-all ${
                    selectedDuration === duration.value
                      ? 'bg-brown-50 border-brown-500 text-brown-700 shadow-brown-glow'
                      : 'bg-surface border-separator hover:border-brown-300 hover:bg-brown-50/50'
                  }`}
                >
                  {duration.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Settings Expandable */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none px-4 py-3 bg-surface-secondary rounded-hig-lg border border-separator/30 hover:bg-fill transition-all">
            <span className="text-xs font-bold text-label-primary">Advanced Settings</span>
            <svg 
              className="w-4 h-4 text-label-tertiary group-open:rotate-180 transition-transform" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          
          <div className="mt-4 space-y-4 px-2">
            {/* Temperature - Text */}
            {type === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-label-secondary">Temperature</label>
                  <span className="text-xs font-bold text-brown">0.7</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1" 
                  defaultValue="0.7"
                  className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-brown"
                />
              </div>
            )}
            
            {/* Max Tokens - Text */}
            {type === 'text' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-label-secondary">Max Tokens</label>
                  <span className="text-xs font-bold text-brown">2048</span>
                </div>
                <input 
                  type="range" 
                  min="256" 
                  max="32000" 
                  step="256" 
                  defaultValue="2048"
                  className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-brown"
                />
              </div>
            )}
            
            {/* Guidance Scale - Image */}
            {type === 'image' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-label-secondary">Guidance Scale</label>
                  <span className="text-xs font-bold text-teal">7.5</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="20" 
                  step="0.5" 
                  defaultValue="7.5"
                  className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-teal"
                />
              </div>
            )}
            
            {/* Steps - Image */}
            {type === 'image' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-label-secondary">Steps</label>
                  <span className="text-xs font-bold text-teal">50</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="150" 
                  step="10" 
                  defaultValue="50"
                  className="w-full h-2 bg-surface-secondary rounded-full appearance-none cursor-pointer accent-teal"
                />
              </div>
            )}
            
            {/* Seed */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-label-secondary">Seed (Optional)</label>
              <input 
                type="number" 
                placeholder="Random"
                className="w-full h-10 px-3 bg-fill border border-separator/30 rounded-hig-lg text-xs focus:ring-2 focus:ring-brown/20 outline-none"
              />
            </div>
          </div>
        </details>

        {/* Cost Estimate */}
        <div className="p-4 bg-gradient-to-br from-brown-50 to-teal-50 border border-brown-200 rounded-hig-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-label-secondary uppercase tracking-widest">Est. Cost</span>
            <span className="text-lg font-bold text-brown">$0.05</span>
          </div>
          <p className="text-[10px] text-label-tertiary leading-relaxed">
            Based on current settings and selected model
          </p>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-separator/50 space-y-3">
        <button className="w-full h-11 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-float hover:shadow-hig-hover hover:scale-105 active:scale-95 transition-all">
          Apply Settings
        </button>
        <button className="w-full h-10 bg-surface-secondary border border-separator/30 rounded-hig-lg text-sm font-semibold text-label-secondary hover:bg-fill transition-all">
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
