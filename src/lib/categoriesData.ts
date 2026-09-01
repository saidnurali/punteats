import coffeeTeaIcon from '../../assets/images/coffee and tea icon.jpeg';

export { coffeeTeaIcon };

export interface CategoryItem {
  id: string;
  name: string;
  emoji?: string;
  image?: any;
}

export const CATEGORIES: CategoryItem[] = [
  { id: '0', name: 'All', emoji: '🍽️' },
  { id: '1', name: 'Pizza', emoji: '🍕' },
  { id: '2', name: 'Burger', emoji: '🍔' },
  { id: '3', name: 'Chicken', emoji: '🍗' },
  { id: '4', name: 'Rice', emoji: '🍚' },
  { id: '5', name: 'Shawarma', emoji: '🌯' },
  { id: '6', name: 'Pasta', emoji: '🍝' },
  { id: '7', name: 'BBQ & Grill', emoji: '🥩' },
  { id: 'coffee-tea', name: 'Coffee & Tea', emoji: '☕' },
  { id: '8', name: 'Desserts', emoji: '🍰' },
  { id: '9', name: 'Drinks', emoji: '🧃' },
  { id: '10', name: 'Somali Food', emoji: '🐪' },
  { id: '11', name: 'Seafood', emoji: '🍤' },
  { id: '12', name: 'Breakfast', emoji: '🍳' },
];
