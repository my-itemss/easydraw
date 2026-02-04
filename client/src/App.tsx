import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import Canvas from './pages/Canvas';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/canvas/:id" element={<Canvas/>} />
      </Routes>
    </BrowserRouter>
  );
}
export default App; 