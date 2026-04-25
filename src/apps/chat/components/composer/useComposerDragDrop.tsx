import * as React from 'react';

import { SvgIcon } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';

import { useDragDropDataTransfer } from '~/common/components/dnd-dt/useDragDropDataTransfer';


export function useComposerDragDrop(
  enabled: boolean,
  onDataTransfer: (dataTransfer: DataTransfer, type: 'paste' | 'drop', isDropOnTextarea: boolean) => Promise<any>,
) {

  // drop implementation for the composer
  const handleComposerDrop = React.useCallback(async (dataTransfer: DataTransfer) => {

    // VSCode: detect failure of dropping from VSCode, details below:
    //         https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572
    if (dataTransfer.types.includes('codeeditors')) {

      // Get the file paths
      let filePaths: string[] = [];
      if (dataTransfer.types.includes('codefiles')) {
        filePaths = JSON.parse(dataTransfer.getData('codefiles'));
      } else if (dataTransfer.types.includes('text/plain')) {
        filePaths = dataTransfer.getData('text/plain').split('\n').filter(Boolean);
      }
      const fileNames = filePaths.map(path => path.split('\\').pop() || path.split('/').pop() || 'unknown file');

      // just show an old school alert message (save callbacks)
      return alert([
        `从 VSCode 拖放了 ${fileNames.length} 个文件:`,
        ...fileNames.map((name, index) => `${index + 1}. ${name}`),
        '',
        'VSCode 不支持拖放到浏览器。https://github.com/microsoft/vscode/issues/98629#issuecomment-634475572.',
        '',
        '请使用上传 📎、粘贴 📋 或从文件夹拖放 📁。',
      ].join('\n'));
    }

    // textarea drop
    void onDataTransfer(dataTransfer, 'drop', true); // fire/forget

  }, [onDataTransfer]);

  return useDragDropDataTransfer(enabled, '释放文件以上传', AttachFileRoundedIcon as typeof SvgIcon, 'largeIcon', false, handleComposerDrop);
}
