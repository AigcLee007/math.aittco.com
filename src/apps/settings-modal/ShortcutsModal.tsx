import * as React from 'react';

import { ScaledTextBlockRenderer } from '~/modules/blocks/ScaledTextBlockRenderer';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIContentScaling } from '~/common/stores/store-ui';
import { Box } from '@mui/joy';


const shortcutsMd = platformAwareKeystrokes(`

| 快捷键         | 描述                                    |
|------------------|-----------------------------------------|
| **编辑**         |                                         |
| Shift + Enter    | 换行                                    |
| Alt + Enter      | 追加 (不响应)                           |
| Ctrl + Enter     | 多模型融合 (并启动所有模型)                  |
| Ctrl + Shift + Z | **重新生成** 上一条消息                 |
| Ctrl + Shift + B | **多模型融合** 上一条消息                     |
| Ctrl + Shift + F | 附加文件                                |
| Ctrl + Shift + V | 附加剪贴板内容 (优于 Ctrl + V)          |
| Ctrl + M         | 麦克风 (语音输入)                       |
| Ctrl + L         | 切换模型                                |
| Ctrl + P         | 切换角色 (Persona)                      |
| **对话**         |                                         |
| Ctrl + O         | 打开对话 ...                            |
| Ctrl + S         | 保存对话 ...                            |
| Ctrl + Shift + N | **新建** 对话                           |
| Ctrl + Shift + X | **重置** 对话                           |
| Ctrl + Shift + D | **删除** 对话                           |
| Ctrl + Up        | 上一条消息/融合 (Shift 移至顶部)        |
| Ctrl + Down      | 下一条消息/融合 (Shift 移至底部)        |
| Ctrl + [         | **上一个** 对话 (历史记录)              |
| Ctrl + ]         | **下一个** 对话 (历史记录)              |
| **设置**         |                                         |
| Ctrl + ,         | ⚙️ 偏好设置                             |
| Ctrl + Shift + M | 🧠 模型                                 |
| Ctrl + Shift + O | 💬 选项 (当前对话模型)                  |
| Ctrl + Shift + A | 切换 AI 请求检查器                      |
| Ctrl + Shift + + | 增加字号                                |
| Ctrl + Shift + - | 减小字号                                |
| Ctrl + Shift + / | 快捷键                                  |

`).trim();


export function ShortcutsModal(props: { onClose: () => void }) {

  // external state
  const isMobile = useIsMobile();
  const contentScaling = useUIContentScaling();

  return (
    <GoodModal open fullscreen={isMobile} title='桌面快捷键' onClose={props.onClose}>
      <Box sx={{ mx: -2 }}>
        <ScaledTextBlockRenderer
          text={shortcutsMd}
          contentScaling={contentScaling}
          textRenderVariant='markdown'
        />
      </Box>
    </GoodModal>
  );
}
