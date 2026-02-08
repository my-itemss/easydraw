import { useNavigate } from "react-router-dom";
import { useState } from "react";

export const Home = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(t => (t === "dark" ? "light" : "dark"));
  };

  const handleStartDrawing = async () => {
    try {
      const res = await fetch("http://localhost:3001/create-session", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to create canvas");

      const data = await res.json();
      navigate(`/canvas/${data.id}`);
    } catch (err) {
      console.error(err);
      alert("Unable to start canvas");
    }
  };

  return (
    <div
      className={`flex items-center justify-center h-screen transition-colors ${
        theme === "dark"
          ? "bg-black text-white"
          : "bg-white text-black"
      }`}
    >
      <div className="flex items-center justify-center gap-10">

        <button
          onClick={handleStartDrawing}
          className="flex flex-col items-center cursor-pointer"
        >
          <img
            src="/images/create.png"
            alt="Create canvas"
            className="w-28 h-28"
          />
        </button>

        <button className="cursor-pointer">
          <img
            src="/images/Docs.png"
            alt="Docs"
            className="w-24 h-24"
          />
        </button>

        <button onClick={toggleTheme} className="cursor-pointer">
          {theme === "dark" ? (
            <img
              src="/images/bulb/off.png"
              alt="Light mode"
              className="w-20 h-28"
            />
          ) : (
            <img
              src="/images/bulb/on1.png"
              alt="Dark mode"
              className="w-20 h-28"
            />
          )}
        </button>

      </div>
    </div>
  );
};
