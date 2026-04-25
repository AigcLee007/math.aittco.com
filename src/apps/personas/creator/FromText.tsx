import * as React from 'react';

import { Box, Button, Textarea, Typography } from '@mui/joy';
import TextFieldsIcon from '@mui/icons-material/TextFields';

import { lineHeightTextareaMd } from '~/common/app.theme';

import type { SimplePersonaProvenance } from '../store-app-personas';


// minimum number of characters required to create from text
const MIN_CHARS = 100;


export function FromText(props: {
  isCreating: boolean;
  onCreate: (text: string, provenance: SimplePersonaProvenance) => void;
}) {

  // state
  const [text, setText] = React.useState('');

  const handleCreateFromText = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // stop the form submit
    props.onCreate(text, { type: 'text' });
  };

  return <>

    <Typography level='title-md' startDecorator={<TextFieldsIcon />} sx={{ mb: 3 }}>
      <b>文本</b> -&gt; 角色
    </Typography>

    <form onSubmit={handleCreateFromText}>
      <Textarea
        required
        variant='outlined'
        minRows={4} maxRows={8}
        placeholder='在这里粘贴你的文本（例如推文、社交媒体内容等）...'
        value={text}
        onChange={event => setText(event.target.value)}
        sx={{
          backgroundColor: 'background.level1',
          '&:focus-within': {
            backgroundColor: 'background.popup',
          },
          lineHeight: lineHeightTextareaMd,
          mb: 1.5,
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          type='submit' variant='solid'
          disabled={props.isCreating || text?.length < MIN_CHARS}
          sx={{ minWidth: 140 }}
        >
          创建
        </Button>

        <Typography level='body-sm'>
          {text.length < MIN_CHARS ? `(${MIN_CHARS - text.length})` : text.length.toLocaleString()}
        </Typography>
      </Box>
    </form>

  </>;
}