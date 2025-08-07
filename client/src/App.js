import Form from './modules/Forms/index.jsx'
import Dashboard from './modules/Dashboard/index.jsx'
import { Routes, Route, Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, auth = false }) => {
  const isLoggedIn = localStorage.getItem('user:detail') !== null;
  if (!isLoggedIn && auth) {
    return <Navigate to={'/users/sign_in'} />
  } else if (isLoggedIn && ['/users/sign_in', '/users/sign_up'].includes(window.location.pathname)) {
    return <Navigate to={'/'} />
  }
  return children;
}

function App() {
  return (
    <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 min-h-screen font-sans">
      <Routes>
        <Route path='/' element={
          <ProtectedRoute auth={true}>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path='/users/sign_in' element={
          <ProtectedRoute>
            <Form isSignInPage={true} />
          </ProtectedRoute>}
        />
        <Route path='/users/sign_up' element={
          <ProtectedRoute>
            <Form isSignInPage={false} />
          </ProtectedRoute>}
        />
      </Routes>
    </div>
  );
}

export default App;