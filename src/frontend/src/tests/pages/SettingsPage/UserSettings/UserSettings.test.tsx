/*
 * This file is part of NER's FinishLine and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { UseMutationResult, UseQueryResult } from 'react-query';
import { UserSettings } from 'shared';
import { useLogUserIn, useSingleUserSettings, useUpdateUserSettings } from '../../../../hooks/users.hooks';
import * as userHooks from '../../../../hooks/users.hooks';
import { mockUseMutationResult, mockUseQueryResult } from '../../../test-support/test-data/test-utils.stub';
import { exampleUserSettingsLight } from '../../../test-support/test-data/user-settings.stub';
import { fireEvent, render, screen } from '../../../test-support/test-utils';
import UserSettingsComponent from '../../../../pages/SettingsPage/UserSettings/UserSettings';
import { mockLogUserInReturnValue, mockLogUserInDevReturnValue } from '../../../test-support/mock-hooks';

jest.mock('../../../../pages/SettingsPage/UserSettings/UserSettingsView', () => {
  return {
    __esModule: true,
    default: () => {
      return <div>user-settings-view</div>;
    }
  };
});

jest.mock('../../../../pages/SettingsPage/UserSettings/UserSettingsEdit', () => {
  return {
    __esModule: true,
    default: () => {
      return <div>user-settings-edit</div>;
    }
  };
});

jest.mock('../../../../hooks/users.hooks');

const mockedUseSingleUserSettings = useSingleUserSettings as jest.Mock<UseQueryResult<UserSettings>>;

const mockUserSettingsHook = (isLoading: boolean, isError: boolean, data?: UserSettings, error?: Error) => {
  mockedUseSingleUserSettings.mockReturnValue(mockUseQueryResult<UserSettings>(isLoading, isError, data, error));
};

const mockedUseUpdateUserSettings = useUpdateUserSettings as jest.Mock<UseMutationResult>;

const mockUseUpdateUserSettingsHook = (isLoading: boolean, isError: boolean, error?: Error) => {
  mockedUseUpdateUserSettings.mockReturnValue(
    mockUseMutationResult<{ in: string }>(isLoading, isError, { in: 'hi' }, error)
  );
};

const mockedUseLogUserIn = useLogUserIn as jest.Mock<UseMutationResult>;

const mockUseLogUserInHook = (isLoading: boolean, isError: boolean, error?: Error) => {
  mockedUseLogUserIn.mockReturnValue(mockUseMutationResult<{ in: string }>(isLoading, isError, { in: 'hi' }, error));
};

/**
 * Sets up the component under test with the desired values and renders it.
 */
const renderComponent = () => {
  mockUseLogUserInHook(false, false);
  mockUseUpdateUserSettingsHook(false, false);
  return render(<UserSettingsComponent userId={1} />);
};

describe('user settings component', () => {
  beforeEach(() => {
    jest.spyOn(userHooks, 'useLogUserIn').mockReturnValue(mockLogUserInReturnValue);
    jest.spyOn(userHooks, 'useLogUserInDev').mockReturnValue(mockLogUserInDevReturnValue);
  });

  it('renders title', () => {
    mockUserSettingsHook(false, false, exampleUserSettingsLight);
    renderComponent();
    expect(screen.getByText('User Settings')).toBeInTheDocument();
  });

  it('renders user settings view', () => {
    mockUserSettingsHook(false, false, exampleUserSettingsLight);
    renderComponent();
    expect(screen.getByText('user-settings-view')).toBeInTheDocument();
  });

  it('renders edit pencil icon button', () => {
    mockUserSettingsHook(false, false, exampleUserSettingsLight);
    renderComponent();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays edit form when edit pencil icon button is clicked', () => {
    mockUserSettingsHook(false, false, exampleUserSettingsLight);
    renderComponent();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('user-settings-edit')).toBeInTheDocument();
  });

  it('does not render edit pencil icon button after clicked', () => {
    mockUserSettingsHook(false, false, exampleUserSettingsLight);
    renderComponent();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryAllByRole('button').map((e) => e.innerHTML)).toStrictEqual(['Cancel', 'Save']);
  });
});
