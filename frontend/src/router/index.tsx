import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import Home from '../pages/Home';
import UserSetting from '../pages/UserSetting';
import VideoDocument from '../pages/Document/VideoDocument';
import BilibiliCookieManage from '../pages/BilibiliCookieManage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'setting',
        element: <UserSetting />,
      },
      {
        path: 'records',
        element: <div>我的记录（待实现）</div>,
      },
      {
        path: 'document/:id',
        element: <VideoDocument />,
      },
      {
        path: 'cookies',
        element: <BilibiliCookieManage />,
      },
    ],
  },
]);
