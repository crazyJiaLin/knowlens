import { Outlet } from 'react-router-dom';
import LoginModal from './components/LoginModal';
import Header from './components/Layout/Header';

function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header />
      <div style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </div>
      <LoginModal />
    </div>
  );
}

export default App;
