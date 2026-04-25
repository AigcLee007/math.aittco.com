import * as React from 'react';

import { BananaApp } from '~/apps/banana/BananaApp';

import { withNextJSPerPageLayout } from '~/common/layout/withLayout';


export default withNextJSPerPageLayout({ type: 'optima' }, () => <BananaApp />);
