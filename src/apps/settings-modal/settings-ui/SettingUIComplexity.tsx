import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { UIComplexityMode } from '~/common/app.theme';
import { FormSelectControl, FormSelectOption } from '~/common/components/forms/FormSelectControl';
import { useUIPreferencesStore } from '~/common/stores/store-ui';


const AppearanceOptions: FormSelectOption<UIComplexityMode>[] = [
  { value: 'minimal', label: '极简', description: '简洁' },
  { value: 'pro', label: '专业 (默认)', description: '完美' },
  { value: 'extra', label: '扩展', description: 'GIF 及更多' },
];

export function SettingUIComplexity(props: { noLabel?: boolean }) {

  // external state
  const [complexityMode, setComplexityMode] = useUIPreferencesStore(useShallow(state => [state.complexityMode, state.setComplexityMode]));

  return (
    <FormSelectControl
      title={props.noLabel ? undefined : '外观'}
      options={AppearanceOptions}
      value={complexityMode}
      onChange={setComplexityMode}
      selectSx={{ minWidth: 150 }}
    />
  );
}
