import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Box, Button, Card, CardContent, Checkbox, IconButton, Textarea, Tooltip, Typography } from '@mui/joy';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveIcon from '@mui/icons-material/Save';
import RestoreIcon from '@mui/icons-material/Restore';

import { SystemPurposeId, SystemPurposes } from '../../data';
import { usePurposeStore } from '~/apps/chat/components/persona-selector/store-purposes';
import { useChatStore } from '~/common/stores/chat/store-chats';


// 'special' purpose IDs
const PURPOSE_ID_PERSONA_CREATOR = '__persona-creator__';
const tileSize = 6; // rem


function PersonaTile(props: {
  text?: string,
  symbol?: string,
  imageUrl?: string,
  isSelected: boolean,
  isHidden: boolean,
  isEditing: boolean,
  onToggleHidden: () => void,
  onEdit: () => void,
}) {
  return (
    <Box sx={{ position: 'relative' }}>
      <Button
        variant={props.isHidden ? 'outlined' : 'soft'}
        color={props.isEditing ? 'primary' : props.isSelected ? 'primary' : 'neutral'}
        onClick={props.onEdit}
        sx={{
          aspectRatio: 1,
          width: `${tileSize}rem`,
          height: `${tileSize}rem`,
          fontWeight: 'md',
          lineHeight: 'xs',
          paddingInline: 0.5,
          borderRadius: 'sm',
          flexDirection: 'column',
          gap: 1,
          opacity: props.isHidden ? 0.5 : 1,
          transition: 'all 0.2s ease',
          border: props.isEditing ? '2px solid' : undefined,
          borderColor: props.isEditing ? 'primary.500' : undefined,
        }}
      >
        <Avatar
          variant='plain'
          src={props.imageUrl}
          sx={{
            '--Avatar-size': '2.5rem',
            fontSize: '1.5rem',
            borderRadius: props.imageUrl ? 'sm' : 0,
          }}
        >
          {props.symbol}
        </Avatar>
        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
          {props.text}
        </div>
      </Button>
      {/* 显示/隐藏勾选框 */}
      <Checkbox
        variant='soft'
        color='primary'
        checked={!props.isHidden}
        onChange={(e) => {
          e.stopPropagation();
          props.onToggleHidden();
        }}
        sx={{ position: 'absolute', left: '0.3rem', top: '0.3rem', zIndex: 1 }}
      />
    </Box>
  );
}


/**
 * AI 角色设置面板 - 在设置页中管理 AI 角色的显示/隐藏与编辑系统提示词
 */
export function PersonasSettings() {

  // state
  const [editingId, setEditingId] = React.useState<SystemPurposeId | null>(null);
  const [editedMessage, setEditedMessage] = React.useState('');
  const [originalMessage, setOriginalMessage] = React.useState('');

  const { hiddenPurposeIDs, toggleHiddenPurposeId } = usePurposeStore(useShallow(state => ({
    hiddenPurposeIDs: state.hiddenPurposeIDs,
    toggleHiddenPurposeId: state.toggleHiddenPurposeId,
  })));

  const defaultPurposeId = useChatStore(state => {
    const latestConv = state.conversations[0];
    return latestConv?.systemPurposeId ?? 'Generic';
  });

  const purposeIDs = Object.keys(SystemPurposes) as SystemPurposeId[];

  // handlers
  const handleEdit = React.useCallback((spId: SystemPurposeId) => {
    if (editingId === spId) {
      // 点击同一个则关闭编辑
      setEditingId(null);
      return;
    }
    const msg = SystemPurposes[spId].systemMessage;
    setEditingId(spId);
    setEditedMessage(msg);
    setOriginalMessage(msg);
  }, [editingId]);

  const handleSave = React.useCallback(() => {
    if (editingId) {
      SystemPurposes[editingId].systemMessage = editedMessage;
      setOriginalMessage(editedMessage);
    }
  }, [editingId, editedMessage]);

  const handleRestore = React.useCallback(() => {
    setEditedMessage(originalMessage);
  }, [originalMessage]);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>

      <Typography level='title-md'>
        AI 角色管理
      </Typography>

      <Typography level='body-sm' sx={{ color: 'text.secondary' }}>
        点击角色可以编辑系统提示词。使用左上角的勾选框控制角色在对话时是否可见。
      </Typography>

      {/* 角色网格 */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${tileSize}rem, ${tileSize}rem))`,
        gap: 0.75,
      }}>
        {purposeIDs.map((spId) => {
          const purpose = SystemPurposes[spId];
          return (
            <PersonaTile
              key={spId}
              text={purpose.title}
              symbol={purpose.symbol}
              imageUrl={purpose.imageUri}
              isSelected={defaultPurposeId === spId}
              isHidden={hiddenPurposeIDs.includes(spId)}
              isEditing={editingId === spId}
              onToggleHidden={() => toggleHiddenPurposeId(spId)}
              onEdit={() => handleEdit(spId)}
            />
          );
        })}
      </Box>

      {/* 编辑面板 */}
      {editingId && (
        <Card variant='outlined' sx={{ mt: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <EditRoundedIcon fontSize='small' color='primary' />
              <Typography level='title-sm'>
                编辑「{SystemPurposes[editingId].title}」的系统提示词
              </Typography>
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                <Tooltip title='还原'>
                  <IconButton size='sm' variant='plain' color='neutral' onClick={handleRestore}>
                    <RestoreIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title='保存'>
                  <IconButton size='sm' variant='soft' color='primary' onClick={handleSave}>
                    <SaveIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Textarea
              variant='outlined'
              minRows={4}
              maxRows={12}
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              sx={{
                fontSize: 'sm',
                fontFamily: 'code',
                backgroundColor: 'background.popup',
              }}
            />
            <Typography level='body-xs' sx={{ mt: 1, color: 'text.tertiary' }}>
              提示：修改后点击保存按钮生效。支持使用 {'{{LocaleNow}}'} 等模板变量。
            </Typography>
          </CardContent>
        </Card>
      )}

      <Typography level='body-xs' sx={{ color: 'text.tertiary' }}>
        当前共 {purposeIDs.length} 个角色，已隐藏 {hiddenPurposeIDs.filter(id => id !== PURPOSE_ID_PERSONA_CREATOR).length} 个。
      </Typography>

    </Box>
  );
}
