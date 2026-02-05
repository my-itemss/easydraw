import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export const Home = () => {

  const [theme, setTheme ] = useState('light');

  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const handleStartDrawing = async () => {
    const response = await fetch('http://localhost:5000/create-session', { method: 'POST' });
    const data = await response.json();
    navigate(data.url);
  };

  return (
    <div 
    className={`flex items-center justify-center h-screen text-white ${
      theme === 'dark' ? 'bg-black' : 'bg-white text-black'
    }`}>
      <div className='flex items-center justify-center gap-8'>
         <a
        className="flex flex-col items-center justify-center cursor-pointer"
        onClick={handleStartDrawing}>
       <img src="/images/create.png" alt="Logo" className="w-30 h-30 cursor-pointer" />
      </a>
      <a>
       <img src="/images/Docs.png" alt="Logo" className="w-26 h-26 cursor-pointer" />
      </a>
      <a
      className='cursor-pointer'
      >
       {theme === 'dark' ? (
      <img src="/images/bulb/off.png" alt="Light Theme" className="w-21 h-30 cursor-pointer" onClick={toggleTheme} />
       ):(
        <img src="/images/bulb/on1.png" alt="Dark Theme" className="w-21 h-30 cursor-pointer" onClick={toggleTheme} />
       )}
      </a>
      </div>
    </div>
  );
};

