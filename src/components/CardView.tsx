import { Card } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface CardViewProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function CardView({ card, onClick, disabled, className }: CardViewProps) {
  const colorMap = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };

  let content = '';
  if (card.type === 'number') content = card.value?.toString() || '0';
  else if (card.type === 'skip') content = 'Ø';
  else if (card.type === 'reverse') content = '⇄';
  else if (card.type === '+2') content = '+2';

  return (
    <motion.button
      whileHover={!disabled ? { y: -10 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      className={cn(
        "relative w-24 h-36 rounded-xl border-4 border-white flex flex-col justify-between p-2 shadow-lg",
        colorMap[card.color],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="absolute top-2 left-2 text-white font-bold text-lg drop-shadow-md">{content}</div>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="w-16 h-24 bg-white/20 rotate-12 rounded-full absolute" />
        <span className="text-white font-black text-4xl drop-shadow-lg z-10">{content}</span>
      </div>

      <div className="absolute bottom-2 right-2 text-white font-bold text-lg drop-shadow-md rotate-180">{content}</div>
    </motion.button>
  );
}
