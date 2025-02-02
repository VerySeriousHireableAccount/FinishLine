/*
 * This file is part of NER's FinishLine and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { UseMutationResult } from 'react-query';
import { useCreateStandardChangeRequest } from '../../../hooks/change-requests.hooks';
import { mockUseMutationResult } from '../../test-support/test-data/test-utils.stub';
import { render, routerWrapperBuilder, screen } from '../../test-support/test-utils';
import CreateChangeRequest from '../../../pages/CreateChangeRequestPage/CreateChangeRequest';

jest.mock('../../../hooks/change-requests.hooks');

// random shit to make test happy by mocking out this hook
const mockedUseCreateStandardCR = useCreateStandardChangeRequest as jest.Mock<UseMutationResult>;

const mockUseCreateStandardCRHook = (isLoading: boolean, isError: boolean, error?: Error) => {
  mockedUseCreateStandardCR.mockReturnValue(mockUseMutationResult<{ in: string }>(isLoading, isError, { in: 'hi' }, error));
};

jest.mock('../../../pages/CreateChangeRequestPage/CreateChangeRequestView', () => {
  return {
    __esModule: true,
    default: () => {
      return <div>create-change-request-view page</div>;
    }
  };
});

const renderComponent = () => {
  const RouterWrapper = routerWrapperBuilder({});
  return render(
    <RouterWrapper>
      <CreateChangeRequest />
    </RouterWrapper>
  );
};

describe.skip('create change request', () => {
  it('renders change request create form', () => {
    mockUseCreateStandardCRHook(false, false);
    renderComponent();

    expect(screen.getByText(`create-change-request-view page`)).toBeInTheDocument();
  });

  it('renders error message', () => {
    mockUseCreateStandardCRHook(false, true, new Error('test error'));
    renderComponent();

    expect(screen.getByText('Oops, sorry!')).toBeInTheDocument();
  });

  it('renders loading message', () => {
    mockUseCreateStandardCRHook(true, false);
    renderComponent();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});
