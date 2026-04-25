import * as React from 'react';
import { useModelsStore } from '~/common/stores/llms/store-llms';

/**
 * 检测 API Key 的类型
 */
function detectKeyType(apiKey: string): 'openai' | 'anthropic' | 'gemini' | 'unknown' {
  if (!apiKey) return 'unknown';
  
  // OpenAI 格式: sk-...
  if (apiKey.startsWith('sk-')) return 'openai';
  
  // Anthropic 格式: sk-ant-...
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  
  // Gemini 格式: AI...
  if (apiKey.startsWith('AI')) return 'gemini';
  
  return 'unknown';
}

/**
 * 查找兼容的服务
 */
function findCompatibleServices(keyType: string, currentServiceId?: string): Array<{ id: string; label: string; vId: string }> {
  const state = useModelsStore.getState();
  const services = state.llms || [];
  const compatible: Array<{ id: string; label: string; vId: string }> = [];

  if (keyType === 'openai') {
    // OpenAI Key 可用于 OpenAI 和 Banana Studio
    services.forEach((service: any) => {
      if (service.vId === 'openai' && service.id !== currentServiceId) {
        compatible.push({ id: service.id, label: 'OpenAI', vId: service.vId });
      }
    });
    
    // 添加 Banana Studio
    const bananaKey = localStorage.getItem('banana-api-key');
    if (!bananaKey && currentServiceId !== 'banana-studio') {
      compatible.push({ id: 'banana-studio', label: 'Banana Studio', vId: 'banana' });
    }
  }

  return compatible;
}

export interface ApiKeySharingResult {
  canShare: boolean;
  compatibleServices: Array<{ id: string; label: string; vId: string }>;
  applyToService: (serviceId: string, apiKey: string) => void;
  applyToAll: (apiKey: string) => void;
}

/**
 * 智能 API Key 共享 Hook
 * 检测 API Key 格式并提供共享建议
 */
export function useApiKeySharing(apiKey: string, currentServiceId?: string): ApiKeySharingResult {
  
  const keyType = React.useMemo(() => detectKeyType(apiKey), [apiKey]);
  
  const compatibleServices = React.useMemo(() => {
    if (!apiKey) return [];
    return findCompatibleServices(keyType, currentServiceId);
  }, [apiKey, keyType, currentServiceId]);

  const applyToService = React.useCallback((serviceId: string, key: string) => {
    if (serviceId === 'banana-studio') {
      // 应用到 Banana Studio
      localStorage.setItem('banana-api-key', key);
      // 触发页面刷新或事件通知
      window.dispatchEvent(new CustomEvent('banana-api-key-updated', { detail: key }));
    } else {
      // 应用到其他服务需要调用 store 的更新方法
      // 这里暂时只处理 Banana Studio
      console.log(`应用 API Key 到服务: ${serviceId}`);
    }
  }, []);

  const applyToAll = React.useCallback((key: string) => {
    compatibleServices.forEach(service => {
      applyToService(service.id, key);
    });
  }, [compatibleServices, applyToService]);

  return {
    canShare: compatibleServices.length > 0,
    compatibleServices,
    applyToService,
    applyToAll,
  };
}
