'use client'

/*
 * Editorial controls panel — pearl & onyx, hairline-only.
 * Used by image / video / audio surfaces. The prop contract is unchanged so
 * existing pages keep wiring up the same way; only the visual language
 * cascades to the new system (mono labels, paper buttons with ink active state,
 * no glass, no gradients).
 */

import { useState } from 'react'

interface Model {
  id: string
  name: string
  provider: string
  brandName?: string
  version?: string
  category?: string
  type?: string
  [key: string]: unknown
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
  const [selectedBrand, setSelectedBrand] = useState<string>(selectedModel.brandName || selectedModel.provider)

  const brands = Array.from(new Set(models.map(m => m.brandName || m.provider)))
  const brandModels = models.filter(m => (m.brandName || m.provider) === selectedBrand)

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand)
    const firstModel = models.find(m => (m.brandName || m.provider) === brand)
    if (firstModel) onModelChange(firstModel)
  }

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-hairline">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">configure</div>
        <h3 className="font-serif italic text-2xl text-ink mt-1">
          {type[0].toUpperCase() + type.slice(1)}
        </h3>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-7">

        {/* Model — brand + version */}
        <Section label="model">
          <div className="space-y-2">
            <select
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full h-9 px-3 bg-bg border border-hairline rounded-card text-[13px] text-ink outline-none focus:border-ink/40 transition-colors"
            >
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <select
              value={selectedModel.id}
              onChange={(e) => onModelChange(brandModels.find(m => m.id === e.target.value)!)}
              className="w-full h-9 px-3 bg-bg border border-hairline rounded-card text-[13px] text-ink outline-none focus:border-ink/40 transition-colors"
            >
              {brandModels.map(model => (
                <option key={model.id} value={model.id}>{model.version || model.name}</option>
              ))}
            </select>
          </div>
          <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-2">
            {selectedBrand.toLowerCase()} · {(selectedModel.version || selectedModel.name).toLowerCase()}
          </div>
        </Section>

        {/* Aspect ratio */}
        {aspectRatios && onAspectRatioChange && (
          <Section label="aspect ratio">
            <PaperGrid
              cols={2}
              options={aspectRatios}
              selected={selectedAspectRatio}
              onChange={(v) => onAspectRatioChange(v as string)}
            />
          </Section>
        )}

        {/* Quality */}
        {qualityLevels && onQualityChange && (
          <Section label="quality">
            <PaperGrid
              cols={3}
              options={qualityLevels}
              selected={selectedQuality}
              onChange={(v) => onQualityChange(v as string)}
            />
          </Section>
        )}

        {/* Style presets */}
        {stylePresets && onStyleChange && (
          <Section label="style">
            <PaperGrid
              cols={2}
              options={stylePresets}
              selected={selectedStyle}
              onChange={(v) => onStyleChange(v as string)}
            />
          </Section>
        )}

        {/* Duration */}
        {durations && onDurationChange && (
          <Section label="duration">
            <PaperGrid
              cols={2}
              options={durations}
              selected={selectedDuration}
              onChange={(v) => onDurationChange(Number(v))}
            />
          </Section>
        )}

        {/* Advanced */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none px-3 py-2 border border-hairline-soft rounded-sharp hover:border-hairline transition-colors">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">advanced</span>
            <svg className="w-3 h-3 text-ink-muted group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="mt-4 space-y-5 px-1">
            {type === 'image' && (
              <>
                <NumberRange label="guidance scale" min={1} max={20} step={0.5} defaultValue={7.5} />
                <NumberRange label="steps" min={10} max={150} step={10} defaultValue={50} />
              </>
            )}
            <div className="space-y-2">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">seed</div>
              <input
                type="number"
                placeholder="random"
                className="w-full h-9 px-3 bg-bg border border-hairline rounded-card font-mono text-[12px] text-ink placeholder:text-ink-muted outline-none focus:border-ink/40"
              />
            </div>
          </div>
        </details>

        {/* Cost estimate */}
        <div className="border-t border-hairline-soft pt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">est. cost</span>
            <span className="font-serif italic text-[20px] text-ink">$0.05</span>
          </div>
          <p className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-1">
            per generation, current settings
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-hairline flex items-center justify-between">
        <button className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors">
          reset
        </button>
        <button className="px-3 h-7 bg-ink text-bg font-mono text-[10px] tracking-[0.18em] uppercase hover:bg-ink-soft transition-colors">
          apply
        </button>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      {children}
    </section>
  )
}

function PaperGrid({
  cols,
  options,
  selected,
  onChange,
}: {
  cols: 2 | 3
  options: SelectOption[]
  selected?: string | number
  onChange: (v: string | number) => void
}) {
  return (
    <div className={`grid ${cols === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5`}>
      {options.map(option => {
        const active = String(selected) === String(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-9 px-2 border rounded-sharp font-mono text-[11px] tracking-[0.04em] transition-colors ${
              active
                ? 'bg-ink text-bg border-ink'
                : 'bg-bg text-ink-soft border-hairline hover:border-hairline hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function NumberRange({
  label,
  min,
  max,
  step,
  defaultValue,
}: {
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}) {
  const [value, setValue] = useState<number>(defaultValue)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">{label}</span>
        <span className="font-mono text-[11px] tracking-[0.04em] text-accent">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  )
}
