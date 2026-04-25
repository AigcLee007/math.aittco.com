import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { optimizeBananaPrompt, describeBananaImage } from '../banana.api';

interface ControlPanelProps {
  settings: any;
  setSettings: (settings: any) => void;
  isGenerating: boolean;
  onGenerate: (settings: any) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  setSettings,
  isGenerating,
  onGenerate
}) => {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modelNameMap: Record<string, string> = {
    'gemini-3-pro-image-preview': 'Nano Banana Pro(线路一)',
    'gemini-3.1-flash-image-preview': 'Nano Banana 2(推荐)',
    'nano-banana-2': 'Nano Banana Pro(线路二)',
    'gpt-image-1.5': 'GPT-Image 1.5',
  };

  const getModelDisplayName = (id: string) => modelNameMap[id] || id;

  const handleOptimize = async () => {
    if (!settings.prompt || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const results = await optimizeBananaPrompt(settings.prompt);
      if (results && results.length > 0) {
        // Simple implementation: pick the first optimization for now or show a dialog later
        setSettings({ ...settings, prompt: results[0].prompt });
      }
    } catch (e) {
      console.error('Optimization failed', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Convert to base64 (simplified)
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newImages = [...(settings.uploadedImages || []), { previewUrl: base64, data: base64 }];
      setSettings({ ...settings, uploadedImages: newImages.slice(0, 5) });
    };
    reader.readAsDataURL(files[0]);
  };

  return (
    <div className="control-scroll-area">
      {/* Model Section */}
      <section className="control-section">
        <div className="section-label">模型与配置</div>
        <div className="model-card" onClick={() => setShowModelDropdown(!showModelDropdown)}>
          <div className="selected-model">
            {getModelDisplayName(settings.model) || "选择核心模型"}
          </div>
          <span className={`chevron ${showModelDropdown ? 'open' : ''}`}>▼</span>
        </div>

        {showModelDropdown && (
          <div className="model-dropdown">
            {Object.entries(modelNameMap).map(([id, name]) => (
              <div 
                key={id} 
                className={`model-card-item ${settings.model === id ? 'selected' : ''}`}
                onClick={() => {
                  setSettings({ ...settings, model: id });
                  setShowModelDropdown(false);
                }}
              >
                <span>🍌</span> {name}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Prompt Section */}
      <section className="control-section">
        <div className="section-label">
          提示词工程
          <button 
            className={`icon-btn ${isOptimizing ? 'is-optimizing' : ''}`}
            onClick={handleOptimize}
            disabled={isOptimizing || !settings.prompt}
          >
            ✨
          </button>
        </div>
        <div className="prompt-container">
          <textarea
            className="prompt-area"
            value={settings.prompt}
            onChange={(e) => setSettings({ ...settings, prompt: e.target.value })}
            placeholder="描述你想要生成的画面..."
            rows={4}
          />
        </div>
      </section>

      {/* Config Section */}
      <section className="control-section">
        <div className="section-label">配置选项</div>
        <div className="parameter-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <select 
            className="parameter-select"
            value={settings.size}
            style={{ width: '100%', padding: '8px', background: 'var(--banana-glass)', color: '#fff', border: '1px solid var(--banana-border)', borderRadius: '8px' }}
            onChange={(e) => setSettings({ ...settings, size: e.target.value })}
          >
            <option value="1:1">1:1</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
          </select>

          <select 
            className="parameter-select"
            value={settings.resolution}
            style={{ width: '100%', padding: '8px', background: 'var(--banana-glass)', color: '#fff', border: '1px solid var(--banana-border)', borderRadius: '8px' }}
            onChange={(e) => setSettings({ ...settings, resolution: e.target.value })}
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>
      </section>

      {/* Reference Image Section */}
      <section className="control-section">
        <div className="section-label">参考图</div>
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()} style={{ padding: '20px', border: '1px dashed var(--banana-border)', borderRadius: '12px', textAlign: 'center', cursor: 'pointer' }}>
          <span style={{ fontSize: '24px' }}>+</span>
          <div>上传参考图</div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileChange}
            accept="image/*"
          />
        </div>
        
        {settings.uploadedImages?.length > 0 && (
          <div className="preview-list" style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
            {settings.uploadedImages.map((img: any, idx: number) => (
              <div key={idx} className="preview-item" style={{ position: 'relative', width: '60px', height: '60px' }}>
                <Image src={img.previewUrl} alt={`Reference image ${idx + 1}`} fill unoptimized sizes="60px" style={{ objectFit: 'cover', borderRadius: '4px' }} />
                <button 
                  onClick={() => setSettings({ ...settings, uploadedImages: settings.uploadedImages.filter((_: any, i: number) => i !== idx) })}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '12px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="action-footer" style={{ marginTop: 'auto' }}>
        <button 
          className="generate-btn"
          disabled={isGenerating || !settings.prompt || !settings.model}
          onClick={() => onGenerate(settings)}
        >
          {isGenerating ? '正在产生灵感...' : '开始生图 🍌'}
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
