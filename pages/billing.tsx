import * as React from 'react';
import { AppBilling } from '../src/apps/billing/AppBilling';
import { withNextJSPerPageLayout } from '~/common/layout/withLayout';

export default withNextJSPerPageLayout({ type: 'optima' }, () => <AppBilling />);
