import React from 'react';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-white shadow-lg rounded-xl p-6 my-4 ${className || ''}`}>
      <h3 className="text-xl font-semibold text-gray-800 mb-3 border-b-2 border-blue-500 pb-2">{title}</h3>
      <div className="text-gray-700 space-y-2">
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
