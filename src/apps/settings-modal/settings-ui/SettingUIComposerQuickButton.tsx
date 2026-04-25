import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { useUIPreferencesStore } from '~/common/stores/store-ui';


const QuickOptions: FormSelectOption<'off' | 'beam'>[] = [
  { value: 'beam', label: '多模型融合', description: '发散思考' },
  { value: 'off', label: '关闭', description: '隐藏' },
];

export function SettingUIComposerQuickButton(props: { noLabel?: boolean }) {

  // external state
  const [composerQuickButton, setComposerQuickButton] = useUIPreferencesStore(useShallow(state => [state.composerQuickButton, state.setComposerQuickButton]));

  return (
    <FormSelectControl
      title={props.noLabel ? undefined : 'Quick Button'}
      options={QuickOptions}
      value={composerQuickButton}
      onChange={setComposerQuickButton}
      selectSx={{ minWidth: 150 }}
    />
  );
}
