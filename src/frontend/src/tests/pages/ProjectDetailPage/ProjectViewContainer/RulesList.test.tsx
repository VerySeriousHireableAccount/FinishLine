/*
 * This file is part of NER's FinishLine and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { render, screen } from '@testing-library/react';
import * as themeHooks from '../../../../hooks/theme.hooks';
import themes from '../../../../utils/Themes';
import { exampleProject1 } from '../../../test-support/test-data/projects.stub';
import RulesList from '../../../../pages/ProjectDetailPage/ProjectViewContainer/RulesList';

describe('Rendering Work Package Rules Component', () => {
  beforeEach(() => {
    jest.spyOn(themeHooks, 'useTheme').mockReturnValue(themes[0]);
  });

  it('renders the component title', () => {
    render(<RulesList rules={exampleProject1.rules} />);

    expect(screen.getByText(`Rules`)).toBeInTheDocument();
  });

  it('renders all the listed rules', () => {
    render(<RulesList rules={exampleProject1.rules} />);

    expect(screen.getByText('EV3.5.2')).toBeInTheDocument();
  });
});
