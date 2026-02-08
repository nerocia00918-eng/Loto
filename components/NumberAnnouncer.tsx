import React, { useEffect, useState } from 'react';

interface NumberAnnouncerProps {
  number: number | null;
}

const NumberAnnouncer: React.FC<NumberAnnouncerProps> = ({ number }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (number !== null) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [number]);

  if (!show || number === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="relative animate-bounce-short">
        <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 animate-ping"></div>
        <div className="w-48 h-48 bg-loto-red rounded-full flex items-center justify-center shadow-2xl border-8 border-white transform scale-125">
          <span className="text-8xl font-black text-white font-hand drop-shadow-md">
            {number}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NumberAnnouncer;