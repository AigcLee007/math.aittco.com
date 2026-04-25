import React, { useState } from 'react';

interface SettingsModalProps {
  apiKey: string;
  onSave: (key: string) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  apiKey,
  onSave,
  onClose
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: '#1a1a1e', border: '1px solid var(--banana-border)', borderRadius: '16px', padding: '24px', width: '400px', maxWidth: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>设置</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        <div className="setting-section" style={{ marginBottom: '24px' }}>
          <div className="section-title" style={{ fontSize: '12px', color: 'var(--banana-text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>🔑 API 密钥</div>
          <div className="input-container" style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={localKey}
                onChange={e => setLocalKey(e.target.value)}
                placeholder="请输入 API 密钥 (sk-...)"
                style={{ width: '100%', background: 'var(--banana-glass)', border: '1px solid var(--banana-border)', color: '#fff', padding: '10px 12px', borderRadius: '8px', outline: 'none' }}
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}
              >
                {showKey ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
            <button 
              onClick={() => onSave(localKey)}
              style={{ background: 'var(--banana-accent)', color: '#000', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: '600', cursor: 'pointer' }}
            >
              保存
            </button>
          </div>
          <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--banana-text-muted)' }}>您的密钥将安全储存在本地浏览器中。</p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--banana-border)', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer' }}>完成</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
