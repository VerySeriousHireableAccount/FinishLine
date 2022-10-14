/*
 * This file is part of NER's PM Dashboard and licensed under GNU AGPLv3.
 * See the LICENSE file in the repository root folder for details.
 */

import { Switch, Route, Redirect, useHistory } from 'react-router-dom';
import { useAuth } from '../hooks/auth.hooks';
import { useTheme } from '../hooks/theme.hooks';
import { routes } from '../utils/Routes';
import Login from '../pages/LoginPage/Login';
import AppAuthenticated from './AppAuthenticated';

const AppPublic: React.FC = () => {
  const auth = useAuth();
  const history = useHistory();
  const theme = useTheme();

  const devUserId = localStorage.getItem('devUserId');

  const render = (e: any) => {
    if (auth.user) {
      return <AppAuthenticated />;
    }

    if (process.env.NODE_ENV === 'development' && devUserId) {
      auth.devSignin(parseInt(devUserId));
      return <AppAuthenticated />;
    }

    return (
      <Redirect
        to={{
          pathname: routes.LOGIN,
          state: { from: e.location }
        }}
      />
    );
  };

  // eslint-disable-next-line prefer-destructuring
  document.body.style.backgroundColor = theme.bgColor;

  return (
    <html className={theme.className}>
      <Switch>
        <Route path={routes.LOGIN}>
          <Login postLoginRedirect={{ url: history.location.pathname, search: history.location.search }} />
        </Route>
        <Route path="*" render={render} />
      </Switch>
    </html>
  );
};

export default AppPublic;
