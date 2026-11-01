import {
  Book, Calendar, Check, Coffee, Dumbbell, Flower2, Heart, Home, Laptop, Layers, Moon, ShowerHead, Sprout, Star, Sun, Utensils, Wallet,
} from "lucide-react";

/** Os ícones são guardados no banco como texto; aqui viram componentes. */
export const iconMap = {
  sun: Sun, laptop: Laptop, food: Utensils, layers: Layers, dumbbell: Dumbbell, shower: ShowerHead, book: Book,
  moon: Moon, star: Star, coffee: Coffee, calendar: Calendar, sprout: Sprout, flower: Flower2, home: Home,
  wallet: Wallet, heart: Heart, check: Check,
} as const;

export type IconName = keyof typeof iconMap;
export const iconNames = Object.keys(iconMap) as IconName[];
export const getIcon = (name: string) => (iconMap as Record<string, typeof Star>)[name] ?? Star;
