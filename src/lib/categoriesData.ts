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
  { id: '1', name: 'Pizza', image: 'https://wsrv.nl/?url=pngimg.com/uploads/pizza/pizza_PNG44077.png&output=png' },
  { id: '2', name: 'Burger', image: 'https://wsrv.nl/?url=pngimg.com/uploads/burger_sandwich/burger_sandwich_PNG4135.png&output=png' },
  { id: '3', name: 'Chicken', image: 'https://wsrv.nl/?url=pngimg.com/uploads/fried_chicken/fried_chicken_PNG14106.png&output=png' },
  { id: '4', name: 'Rice', emoji: '🍚' },
  { id: '5', name: 'Shawarma', emoji: '🌯' },
  { id: '6', name: 'Pasta', emoji: '🍝' },
  { id: '7', name: 'BBQ & Grill', emoji: '🥩' },
  { id: 'coffee-tea', name: 'Coffee & Tea', image: 'https://wsrv.nl/?url=pngimg.com/uploads/coffee/coffee_PNG17.png&output=png' },
  { id: '8', name: 'Desserts', image: 'https://wsrv.nl/?url=pngimg.com/uploads/cake/cake_PNG13115.png&output=png' },
  { id: '9', name: 'Drinks', image: 'https://wsrv.nl/?url=pngimg.com/uploads/cocacola/cocacola_PNG22.png&output=png' },
  { id: '10', name: 'Somali Food', emoji: '🐪' },
];
