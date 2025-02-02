/*
 * This file is part of NER's FinishLine and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { render, screen } from '../test-support/test-utils';
import * as themeHooks from '../../hooks/theme.hooks';
import themes from '../../utils/Themes';
import PageBlock from '../../layouts/PageBlock';

const renderComponent = (headerRight = false) => {
  return render(
    <PageBlock title={'test'} headerRight={headerRight ? <p>hi</p> : undefined}>
      hello
    </PageBlock>
  );
};

describe('card component', () => {
  beforeEach(() => jest.spyOn(themeHooks, 'useTheme').mockReturnValue(themes[0]));

  it('renders title', () => {
    renderComponent(true);

    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('doesnt render headerRight if none is given', () => {
    renderComponent(false);

    expect(screen.queryByText('hi')).not.toBeInTheDocument();
  });
});
