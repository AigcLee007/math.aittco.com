import * as React from 'react';

import type { SelectSlotsAndSlotProps } from '@mui/joy/Select/SelectProps';
import { Box, ListDivider, listItemButtonClasses, ListItemDecorator, listItemDecoratorClasses, Option, optionClasses, Select, selectClasses, Typography } from '@mui/joy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { ListItemGroupCollapser } from '~/common/components/ListItemGroupCollapser';


// set to true to enable the dense mode, which is default in the rest of the app
const useDenseDropdowns = false;
// set to false to use normal icons - check with similar menus
const useBigIcons = true;


export const optimaSelectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  root: {
    sx: {
      backgroundColor: 'transparent',
      borderRadius: '2rem',
      // minWidth: selectMinWidth, // 160
      maxWidth: 'calc(100dvw - 4.5rem)', /* 36px * 2 buttons (2 * var(--Bar)) */
      // disappear when the 'agi-gone' class is set
      '&.agi-gone': {
        display: 'none',
      } as const,
      // fade when the 'agi-faded' class is set
      '&.agi-faded button': {
        opacity: 0.667,
      } as const,
    } as const,
  } as const,

  button: {
    className: 'agi-ellipsize',
    sx: {
      // these + the ellipsize class will ellipsize the text in the button
      display: 'inline-block',
      maxWidth: { xs: 140, sm: 300 },
      borderRadius: '2rem',
      px: { xs: 1, sm: 1.5 },
    } as const,
  } as const,

  // this is the down-arrow icon half faded
  indicator: {
    sx: {
      // additive white 50%
      color: 'rgba(255 255 255 / 0.5)',
      // revolves around when clicked
      transition: '0.2s',
      [`&.${selectClasses.expanded}`]: {
        transform: 'rotate(-180deg)',
      } as const,
    } as const,
  } as const,

  listbox: {
    // Note: we explored disablePortal, which could optimize performance, but it breaks the colors (as they'll look inverted)
    // disablePortal: false,
    variant: 'outlined',
    placement: 'bottom-start',
    sx: {
      // in sync with CloseableMenu
      '--ListItem-minHeight': useDenseDropdowns
        ? '2.25rem' /* 2.25 is the default */
        : '3.25rem', /* Enlarged for rich items */
      ...(useBigIcons && {
        '--Icon-fontSize': 'var(--joy-fontSize-xl2)',
      }),

      borderRadius: '1.5rem',
      boxShadow: '0 12px 24px -4px rgba(0,0,0,0.1), 0 4px 12px -2px rgba(0,0,0,0.05)',
      p: 0,
      border: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',

      // v-size: do not exceed the height of the screen
      maxHeight: 'calc(100dvh - 56px - 24px)',

      // Option: clip width to 160...360px
      [`& .${optionClasses.root}`]: {
        maxWidth: 'min(380px, calc(100dvw - 1rem))',
        minWidth: 260,
        borderRadius: '0.75rem',
        mx: 0.75,
        my: 0.25,
        transition: 'background 0.2s',
        [`&.${optionClasses.selected}`]: {
          backgroundColor: 'var(--joy-palette-primary-softBg)',
          color: 'var(--joy-palette-primary-softColor)',
        },
      } as const,

      // Decorator: icon background & size
      [`& .${listItemDecoratorClasses.root}`]: {
        fontSize: 'var(--joy-fontSize-xl)', 
        backgroundColor: 'background.surface', // Changed from neutral.softBg to white
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', // Added subtle shadow for depth on white background
        borderRadius: '0.625rem',
        p: '4px', // Reduced padding for larger logo
        mr: 1.5,
      } as const,

      // Button styles
      [`& .${listItemButtonClasses.root}`]: {
        minWidth: 200,
      } as const,
    } as const,
  } as const,
} as const;

const _styles = {

  prependGap: {
    height: 'var(--ListDivider-gap)',
  } as const,

  itemsScrollable: {
    overflowY: 'auto',
    paddingBlock: 'var(--ListDivider-gap)',
    flexGrow: 1,
  } as const,

  divider: {
    my: 0,
  } as const,

} as const;


export type OptimaDropdownItems = Record<string, {
  title: string,
  symbol?: string,
  type?: 'separator'
  icon?: React.ReactNode,
  description?: React.ReactNode,
  coinCost?: number,
  tags?: string[],
}>;


export const OptimaBarDropdownMemo = React.memo(React.forwardRef(OptimaBarDropdown));

export type OptimaBarControlMethods = {
  openListbox: () => void,
  // closeListbox: () => void,
};

/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
function OptimaBarDropdown<TValue extends string>(props: {
  // required
  items: OptimaDropdownItems,
  value: undefined | TValue | null, // undefined means no value is present, null means 'no/unset/force-empty' value
  onChange: (value: TValue | null) => void,
  // optional
  activeEndDecorator?: React.JSX.Element,
  prependOption?: React.JSX.Element
  appendOption?: React.JSX.Element,
  placeholder?: string,
  showSymbols?: boolean | 'compact',
  showGone?: boolean,
  showFaded?: boolean,
  showLabel?: boolean,
  // collapsible separators: when provided, separators become clickable toggle buttons
  collapsedSeparators?: ReadonlySet<string>,
  onSeparatorClick?: (key: string) => void,
}, ref: React.Ref<OptimaBarControlMethods>) {

  // state
  const [listboxOpen, setListboxOpen] = React.useState(false);

  // Expose control methods via the ref
  React.useImperativeHandle(ref, () => ({
    openListbox: () => {
      setListboxOpen(true);
    },
    // closeListbox: () => {
    //   setListboxOpen(false);
    // },
  }), []);

  // derived state
  const { onChange } = props;

  const handleOnChange = React.useCallback((_event: any, value: TValue | null) => {
    onChange(value);
  }, [onChange]);

  const handleOnOpenChange = React.useCallback((isOpen: boolean) => {
    if (isOpen !== listboxOpen)
      setListboxOpen(isOpen);
  }, [listboxOpen]);

  const itemsKeys = Object.keys(props.items);
  const hasItems = itemsKeys.length >= 1;

  return (
    <Select
      variant='plain'
      value={props.value ?? null /* remove 'undefined' as an option */}
      onChange={handleOnChange}
      placeholder={props.placeholder}
      listboxOpen={listboxOpen}
      onListboxOpenChange={handleOnOpenChange}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={optimaSelectSlotProps}
      className={props.showGone ? 'agi-gone' : props.showFaded ? 'agi-faded' : ''}
      renderValue={(selectedOption) => {
        // find the item based on the selected value
        const item = props.items[selectedOption?.value as string];
        if (!item) return props.placeholder;
        const iconOrSymbol = item.icon || item.symbol;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, userSelect: 'none' }}>
            {iconOrSymbol && (
              <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 'var(--joy-fontSize-lg)' }}>
                {iconOrSymbol}
              </Box>
            )}
            {props.showLabel !== false && <span>{item.title}</span>}
          </Box>
        );
      }}
    >

      {/* Prepender (Search Bar) */}
      {!!props.prependOption && (
        <Box sx={{ 
          p: 1.5, 
          pb: 0.5, 
          // '& .MuiInput-root': { border: 'none', bgcolor: 'neutral.softBg', borderRadius: '0.75rem' } 
        }}>
          {props.prependOption}
        </Box>
      )}

      {/* Scrollable Items list*/}
      {hasItems && <Box sx={_styles.itemsScrollable}>
        {itemsKeys.map((_itemKey: string, idx: number) => {
          const _item = props.items[_itemKey];
          const isActive = _itemKey === props.value;

          // Label & Decorators
          const safeTitle = _item.title || '';
          const label = (props.showSymbols && _item.symbol && !(_item.title === 'Default' && _item.symbol === '🧠')) ? `${_item.symbol} ${safeTitle}` : safeTitle;
          const iconOrSymbol = _item.icon || _item.symbol || '';
          const descriptionTitle = typeof _item.description === 'string' ? _item.description : undefined;

          if (_item.type === 'separator')
            return props.onSeparatorClick ? (
              <ListItemGroupCollapser
                key={_itemKey}
                id={_itemKey}
                label={safeTitle}
                isCollapsed={!!props.collapsedSeparators?.has(_itemKey)}
                onToggleCollapse={props.onSeparatorClick}
              />
            ) : (
              <ListDivider key={_itemKey || `sep-${idx}`} sx={{ 
                '--ListDivider-gap': '1rem',
                '&::before, &::after': { borderTop: '1px solid', borderColor: 'divider', opacity: 0.5 },
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'text.tertiary',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                py: 1,
              }}>
                {_item.title}
              </ListDivider>
            );

          return (
            <Option key={_itemKey} value={_itemKey} label={label}>
              {/* Icon / Symbol with its own decorator background now set in listbox sx */}
              {(props.showSymbols === true || (props.showSymbols === 'compact' && !!iconOrSymbol)) && <ListItemDecorator>
                {iconOrSymbol}
              </ListItemDecorator>}

              {/* Text: Title & Description */}
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <div className='agi-ellipsize' style={{ fontWeight: 600, fontSize: '0.95rem' }}>{safeTitle}</div>
                  {typeof _item.coinCost === 'number' && (
                    <Typography
                      level='body-sm'
                      sx={{
                        ml: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        fontWeight: 700,
                        color: '#B26B00',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {_item.coinCost} <span aria-label='coin'>🪙</span>
                    </Typography>
                  )}
                </Box>
                {_item.description && (
                  <Typography 
                    level="body-xs" 
                    title={descriptionTitle}
                    sx={{ color: 'text.tertiary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem' }}
                  >
                    {_item.description}
                  </Typography>
                )}
              </Box>

              {/* Tags - High Fidelity Purple Style */}
              {_item.tags && _item.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                  {_item.tags.map(tag => (
                    <Typography
                      key={tag}
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        px: 0.8,
                        py: 0.4,
                        borderRadius: '0.5rem',
                        backgroundColor: '#F3E8FF', // Light purple
                        color: '#7E22CE',           // Deep purple
                      }}
                    >
                      {tag}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* Selection Checkmark */}
              {isActive && (
                <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', color: 'primary.solidBg' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </Box>
              )}
              
              {/* Active Item Settings (moved slightly if needed, keeping simple) */}
              {isActive && props.activeEndDecorator && (
                 <Box sx={{ ml: 0.5 }}>{props.activeEndDecorator}</Box>
              )}
            </Option>
          );
        })}
      </Box>}

      {/* Appender */}
      {!!props.appendOption && hasItems && <ListDivider sx={_styles.divider} />}
      {props.appendOption}
      {/*{!!props.appendOption && <Box sx={{ height: 'var(--ListDivider-gap)' }} />}*/}

    </Select>
  );
}
