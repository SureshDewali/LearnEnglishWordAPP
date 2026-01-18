import React from 'react';

const Logo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const dimensions = {
    sm: 'w-7 h-7 text-[12px] border-[1.5px]',
    md: 'w-14 h-14 text-2xl border-[2.5px]',
    lg: 'w-20 h-20 text-3xl border-[3.5px]'
  };

  return (
    <div className={`flex items-center justify-center rounded-full border-white/60 bg-white/20 backdrop-blur-3xl shadow-xl ${dimensions[size]} font-black text-white select-none`}>
      <span className="mb-0.5 slogan-font" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>C</span>
    </div>
  );
};

export default Logo;