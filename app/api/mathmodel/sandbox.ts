/**
 * E2B 沙盒集成模块
 * 提供 Python 代码的云端安全执行能力，支持错误自愈 (Reflection)
 */

import { Sandbox } from '@e2b/code-interpreter';

import type { CodeExecutionResult } from './types';

/**
 * 在 E2B 云端沙盒中执行 Python 代码
 */
export async function executeCode(code: string): Promise<CodeExecutionResult> {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    return {
      stdout: '',
      stderr: '',
      images: [],
      error: '未配置 E2B_API_KEY。请在 .env.local 中添加 E2B_API_KEY=your_key',
    };
  }

  let sandbox: Sandbox | null = null;
  try {
    sandbox = await Sandbox.create({ apiKey });

    // 预装中文字体支持
    await sandbox.runCode(`
import matplotlib
matplotlib.rcParams['font.sans-serif'] = ['DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
import warnings
warnings.filterwarnings('ignore')
`);

    const exec = await sandbox.runCode(code, { timeoutMs: 120_000 });

    const stdout = exec.logs.stdout.join('\n');
    const stderr = exec.logs.stderr.join('\n');

    // 提取所有生成的图片 (Base64 PNG)
    const images: string[] = [];
    if (exec.results) {
      for (const result of exec.results) {
        if (result.png) {
          images.push(result.png);
        }
      }
    }

    return {
      stdout,
      stderr,
      images,
      error: exec.error ? `${exec.error.name}: ${exec.error.value}\n${exec.error.traceback}` : null,
    };
  } catch (err: any) {
    return {
      stdout: '',
      stderr: '',
      images: [],
      error: `E2B Sandbox Error: ${err?.message || String(err)}`,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch { /* ignore cleanup errors */ }
    }
  }
}

/**
 * 从 LLM 响应中提取 Python 代码块
 */
export function extractPythonCode(response: string): string {
  // 匹配 ```python ... ``` 代码块
  const codeBlockRegex = /```python\s*\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    matches.push(match[1].trim());
  }

  if (matches.length > 0) {
    return matches.join('\n\n');
  }

  // 如果没有代码块标记，尝试匹配通用代码块
  const genericBlockRegex = /```\s*\n([\s\S]*?)```/g;
  while ((match = genericBlockRegex.exec(response)) !== null) {
    const content = match[1].trim();
    // 如果内容看起来像 Python 代码
    if (content.includes('import ') || content.includes('def ') || content.includes('print(')) {
      matches.push(content);
    }
  }

  return matches.length > 0 ? matches.join('\n\n') : response;
}
