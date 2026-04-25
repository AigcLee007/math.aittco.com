import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { GoodModal } from '~/common/components/modals/GoodModal';

import { ExportChats, ExportConfig } from './ExportChats';
import { ImportChats, ImportConfig } from './ImportChats';

export type TradeConfig = ImportConfig | ExportConfig;

export function TradeModal(props: { config: TradeConfig, onConversationActivate: (conversationId: DConversationId) => void, onClose: () => void }) {
  return (
    <GoodModal
      open onClose={props.onClose}
      dividers
      title={<>
        <b>{props.config.dir === 'import' ? '导入' : props.config.dir === 'export' ? '导出' : ''}</b> {(props.config.dir === 'export' && !props.config.exportAll) ? '对话' : '对话'}
      </>}
    >

      {props.config.dir === 'import' && (
        <ImportChats onConversationActivate={props.onConversationActivate} onClose={props.onClose} />
      )}

      {props.config.dir === 'export' && (
        <ExportChats config={props.config} onClose={props.onClose} />
      )}

    </GoodModal>
  );
}