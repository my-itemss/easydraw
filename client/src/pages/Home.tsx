// Home.tsx
import { useNavigate } from 'react-router-dom';

export const Home = () => {
  const navigate = useNavigate();

  const handleStartDrawing = async () => {
    const response = await fetch('http://localhost:5000/create-session', { method: 'POST' });
    const data = await response.json();
    
    navigate(data.url);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen text-white">
      <button 
        onClick={handleStartDrawing}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-700 rounded-md transition"
      >
        Create New Board
      </button>
    </div>
  );
};
