import React, { useState } from 'react';
import Image from 'next/image';

interface PreviewStageProps {
  currentImage: string | null;
  isGenerating: boolean;
  progress: number;
}

const PreviewStage: React.FC<PreviewStageProps> = ({
  currentImage,
  isGenerating,
  progress
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  const downloadImage = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `banana-studio-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    if (isGenerating) {
      return (
        <div className="item-generating" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div className="scanner" style={{ width: '250px', height: '2px', background: 'var(--banana-accent)', boxShadow: '0 0 15px var(--banana-accent)', animation: 'scan 1.5s infinite alternate' }}></div>
          <div className="status-text" style={{ textAlign: 'center' }}>
             <div style={{ color: 'var(--banana-text-muted)', fontSize: '14px' }}>AI 正在构思像素...</div>
             <div style={{ color: 'var(--banana-accent)', fontSize: '24px', fontWeight: 'bold' }}>{progress}%</div>
          </div>
          <div className="progress-bar-container" style={{ width: '300px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--banana-border)' }}>
            <div className="fill" style={{ width: `${progress}%`, height: '100%', background: 'var(--banana-accent)', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      );
    }

    if (currentImage) {
      return (
        <div className="image-wrapper" style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'flex', justifyContent: 'center' }}>
          <Image
            src={currentImage}
            alt="Generated image preview"
            width={1024}
            height={1024}
            unoptimized
            sizes="(max-width: 1200px) 100vw, 1024px"
            style={{ maxWidth: '100%', maxHeight: '80vh', width: 'auto', height: 'auto', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', transition: 'transform 0.3s' }}
            onClick={() => setIsZoomed(true)}
          />
          <div className="floating-toolbar" style={{ position: 'absolute', bottom: '-40px', display: 'flex', gap: '10px' }}>
            <button className="toolbar-btn" onClick={() => setIsZoomed(true)}>🔍 放大</button>
            <button className="toolbar-btn" onClick={downloadImage}>💾 下载</button>
          </div>
        </div>
      );
    }

    return (
      <div className="empty-state" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: '80px', marginBottom: '10px' }}>🍌</div>
        <h2 style={{ color: 'rgba(255,255,255,0.3)' }}>准备创作您的首个数字艺术</h2>
        <p style={{ color: 'rgba(255,255,255,0.2)' }}>在左侧面板输入您的想法，AI 会为您即时呈现</p>
      </div>
    );
  };

  return (
    <div className="stage-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      {renderContent()}

      {isZoomed && currentImage && (
        <div 
          onClick={() => setIsZoomed(false)}
          style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Image src={currentImage} alt="Zoomed generated image" width={1600} height={1600} unoptimized sizes="90vw" style={{ maxWidth: '90%', maxHeight: '90%', width: 'auto', height: 'auto', objectFit: 'contain' }} />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          from { opacity: 0.3; transform: scaleX(0.5); }
          to { opacity: 1; transform: scaleX(1.1); }
        }
        .toolbar-btn {
          background: var(--banana-glass);
          border: 1px solid var(--banana-border);
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }
        .toolbar-btn:hover {
          background: rgba(255,255,255,0.15);
          border-color: var(--banana-accent);
        }
      `}} />
    </div>
  );
};

export default PreviewStage;
