import React, { createContext, useState, useContext } from 'react';

const EmotionContext = createContext();

export const EmotionProvider = ({ children }) => {
  const [emotion, setEmotion] = useState('neutral');

  const updateEmotion = (newEmotion) => {
    setEmotion(newEmotion);
  };

  return (
    <EmotionContext.Provider value={{ emotion, updateEmotion }}>
      {children}
    </EmotionContext.Provider>
  );
};

export const useEmotion = () => {
  const context = useContext(EmotionContext);
  if (!context) {
    throw new Error('useEmotion must be used within an EmotionProvider');
  }
  return context;
};

export default EmotionContext; 