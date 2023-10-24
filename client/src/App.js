import './App.css';
import Form from './modules/Forms/index.jsx'
import Dashboard from './modules/Dashboard/index.jsx'
import {Routes, Route, Navigate} from 'react-router-dom';

const ProtectedRoute = ({children, auth=false}) => {
  const isLoggedIn = localStorage.getItem('user:token') !== null || false;
  if(!isLoggedIn && auth) {
    return <Navigate to={'users/sign_in'}/>
  } else if(isLoggedIn && ['users/sign_in', 'users/sign_up'].includes(window.location.pathman)){
    return <Navigate to={'/'}/>
  }
  return children;
}
function App() {
  return (
    <div className="bg-[#e1edff] h-screen flex justify-center items-center">
    <Routes>
      <Route path='/' element={
        <ProtectedRoute auth={true}>
          <Dashboard />
        </ProtectedRoute>
      }/>
      <Route path='/users/sign_in' element={
        <ProtectedRoute>
        <Form isSignInPage={true}/>
        </ProtectedRoute>}
      />
      <Route path='/users/sign_up' element={
        <ProtectedRoute>
        <Form isSignInPage={false}/>
        </ProtectedRoute>}
      />
    </Routes>
    </div>
  );
}

export default App;