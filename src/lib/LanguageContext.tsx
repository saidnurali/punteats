import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Lang = "en" | "so";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

// ─── Translation Strings ─────────────────────────────────────────────────────
const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Auth
    welcome_back: "Welcome Back",
    sign_in_to_continue: "Sign in to continue",
    continue_btn: "Continue",
    or_sign_in_with: "Or sign in with",
    dont_have_account: "Don't have an account?",
    sign_up: "Sign Up",
    log_in: "Log In",
    full_name: "Full Name",
    phone_number: "Phone Number",
    enter_full_name: "Enter your full name",
    enter_phone: "Enter phone number",
    create_account: "Create Account",
    already_have_account: "Already have an account?",
    account_not_found: "Account Not Found",
    please_sign_up_first: "Please sign up first to create a PuntEats account.",
    cancel: "Cancel",
    error: "Error",
    something_went_wrong: "Something went wrong. Please try again.",

    // Home
    good_morning: "Good Morning",
    good_afternoon: "Good Afternoon",
    good_evening: "Good Evening",
    delivering_to: "Delivering to",
    garowe_puntland: "Garowe, Puntland",
    search_placeholder: "Search food, restaurants...",
    categories: "Categories",
    see_all: "See all",
    popular_restaurants: "Popular Restaurants",
    top_dishes: "Top Dishes",
    near_you: "Near You",
    food_service: "Food Service",
    taxi_service: "Parcel Delivery",
    order_your_favorite: "Order your\nfavorite food",
    book_a_ride: "Book a ride\nanywhere",
    get_20_off: "Get 20% Off",
    on_first_order: "On your first order",
    order_now: "Order Now",
    all: "All",

    // Categories
    food_categories: "Food Categories",
    dishes_in: "Dishes in",
    no_dishes_found: "No dishes found",
    top_restaurants: "Top Restaurants",

    // Cart
    my_cart: "My Cart",
    cart_empty: "Your cart is empty",
    cart_empty_sub: "Browse restaurants and add delicious items to your cart.",
    browse_food: "Browse Food",
    order_summary: "Order Summary",
    subtotal: "Subtotal",
    delivery_fee: "Delivery Fee",
    total: "Total",
    proceed_to_pay: "Proceed to Pay",
    item_removed: "Item removed from cart",
    added_to_cart: "Added to cart!",
    remove: "Remove",

    // Orders
    my_orders: "My Orders",
    track_order: "Track Order",
    view_details: "View Details",
    no_orders_yet: "No Orders Yet",
    no_orders_sub: "Your order history will appear here. Place your first order now!",
    start_ordering: "Start Ordering",
    pending: "Pending",
    preparing: "Preparing",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    order_items: "Order items",

    // Profile
    my_profile: "My Profile",
    account_settings: "Account Settings",
    edit_profile: "Edit Profile",
    edit_profile_info: "Edit Profile Info",
    save_changes: "Save Changes",
    saved_addresses: "Saved Delivery Addresses",
    notifications: "Notifications",
    order_alerts: "Order alerts & status updates",
    language: "Language",
    language_preference: "Language Preference",
    privacy_security: "Privacy & Security",
    terms_support: "Terms & Support",
    log_out: "Log Out",
    delete_account: "Delete Account",
    delete_confirm_title: "Delete PuntEats Account?",
    delete_confirm_msg: "Warning: This action is permanent. All your order history, addresses, and profile data will be completely removed.",
    yes_delete: "Yes, Delete Everything",
    profile_updated: "Profile Updated ✓",
    profile_saved: "Your personal information has been saved.",
    select_language: "Select Language",
    choose_language: "Choose your preferred language:",
    english: "English",
    somali: "Soomaali (Somali)",
    logging_out: "Logging out...",
    deleting_account: "Deleting account...",

    // Wishlist
    wishlist: "Wishlist",
    wishlist_empty: "Your Wishlist is Empty",
    wishlist_empty_sub: "Explore top restaurants and save your favorite dishes here.",

    // Checkout
    checkout: "Checkout",
    delivery: "Delivery",
    payment: "Payment",
    confirm: "Confirm",
    delivery_address: "Delivery Address",
    delivery_time: "Delivery Time",
    asap: "As soon as possible",
    add_address: "Add New Address",
    address_title: "Address Title",
    full_address: "Full Address",
    save_address: "Save Address",
    payment_method: "Payment Method",
    cash_on_delivery: "Cash on Delivery",
    mobile_number: "Mobile Number",
    place_order: "Place Order",
    order_confirmed: "Order Placed! ✓",
    order_confirmed_sub: "Your order has been placed successfully.",
    confirm_order: "Confirm Order",
    items_in_order: "Items in this order",
    empty_cart_msg: "Your cart is empty. Please add items first.",
    invalid_phone: "Please enter a valid +252 Puntland phone number.",
    next: "Next",
    back: "Back",

    // Search
    search: "Search",
    search_results: "Search Results",
    popular_food: "Popular Food",
    suggested_restaurants: "Suggested Restaurants",
    recent_searches: "Recent Searches",
    no_results: "No results found",
    no_results_sub: "Try a different search term",
    clear: "Clear",

    // Restaurant Detail
    menu: "Menu",
    reviews: "Reviews",
    info: "Info",
    add_to_cart: "Add to Cart",
    customise: "Customise",
    no_menu_items: "No menu items available",
    min_order: "Min. Order",
    delivery_time_label: "Delivery Time",
    write_review: "Write a Review",
    all_reviews: "All Reviews",
    no_reviews: "No reviews yet",
    in_stock: "In Stock",
    out_of_stock: "Out of Stock",
    select_size: "Select Size",
    select_add_ons: "Select Add-ons",

    // General
    ok: "OK",
    close: "Close",
    loading: "Loading...",
    retry: "Retry",
    done: "Done",
    version: "PuntEats v1.0.0 • Garowe, Puntland",
  },
  so: {
    // Auth
    welcome_back: "Ku Soo Dhawoow",
    sign_in_to_continue: "Soo gal si aad u sii wadato",
    continue_btn: "Sii wad",
    or_sign_in_with: "Ama soo gal adoo isticmaalaya",
    dont_have_account: "Ma lihid akoon?",
    sign_up: "Is Qor",
    log_in: "Gal",
    full_name: "Magaca Buuxa",
    phone_number: "Lambarka Telefoonka",
    enter_full_name: "Geli magacaaga buuxa",
    enter_phone: "Geli lambarka telefoonka",
    create_account: "Samee Akoon",
    already_have_account: "Ma haysaa akoon?",
    account_not_found: "Akoon lama Helin",
    please_sign_up_first: "Fadlan is qor marka hore si aad u abuurtid akoon PuntEats.",
    cancel: "Jooji",
    error: "Khalad",
    something_went_wrong: "Wax khalad ah ayaa dhacay. Fadlan isku day mar kale.",

    // Home
    good_morning: "Subax wanaagsan",
    good_afternoon: "Galab wanaagsan",
    good_evening: "Fiid wanaagsan",
    delivering_to: "Waxaa gaadhsiinaya",
    garowe_puntland: "Garoowe, Puntland",
    search_placeholder: "Raadi cunto, makhaayadaha...",
    categories: "Qaybaha",
    see_all: "Dhamaan arag",
    popular_restaurants: "Makhaayadaha Caanka ah",
    top_dishes: "Cuntooyinka Ugu Wanaagsan",
    near_you: "Kugula dhow",
    food_service: "Adeegga Cuntada",
    taxi_service: "Adeegga Xirmooyinka",
    order_your_favorite: "Dalbo\ncuntadaada\njeceshahay",
    book_a_ride: "Dalbo\nsaafarkaaga\nabka ah",
    get_20_off: "Hel 20% Dhimis",
    on_first_order: "Dalbadaadii ugu horreysa",
    order_now: "Hada Dalbo",
    all: "Dhamaan",

    // Categories
    food_categories: "Noocyada Cuntada",
    dishes_in: "Cuntooyinka ku jira",
    no_dishes_found: "Cunto lama helin",
    top_restaurants: "Makhaayadaha Ugu Wanaagsan",

    // Cart
    my_cart: "Dambiilkayga",
    cart_empty: "Dambiilkaagu waa madhan yahay",
    cart_empty_sub: "Booqo makhaayadaha oo ku dar cuntooyinka macaan dambiilkaaga.",
    browse_food: "Raadi Cunto",
    order_summary: "Koobidda Dalabka",
    subtotal: "Wadarta Yar",
    delivery_fee: "Kharashka Gaadhsiinta",
    total: "Wadarta",
    proceed_to_pay: "Bixi",
    item_removed: "Badeecadda waxaa laga saaray dambiilka",
    added_to_cart: "Waxaa lagu daray dambiilka!",
    remove: "Ka saar",

    // Orders
    my_orders: "Dalabyadeeyda",
    track_order: "La soco Dalabka",
    view_details: "Arag Faahfaahinta",
    no_orders_yet: "Wali Dalab Kuma Jiro",
    no_orders_sub: "Taariikhdaada dalabyada ayaa halkan ka muuqan doonta. Hada dalbi dalabkaaga koowaad!",
    start_ordering: "Bilow Dalbashada",
    pending: "La sugayaa",
    preparing: "La diyaarinayaa",
    out_for_delivery: "Waxaa la gaadhsiinayaa",
    delivered: "Waa la gaadhsiiyay",
    cancelled: "Waa la joojiyay",
    order_items: "Badeecadaha dalabka",

    // Profile
    my_profile: "Xogtayda",
    account_settings: "Dejinta Akoonta",
    edit_profile: "Wax ka beddel Xogta",
    edit_profile_info: "Wax ka beddel Macluumaadka Xogta",
    save_changes: "Kaydi Isbedelada",
    saved_addresses: "Ciwaannada La Kaydsaday",
    notifications: "Ogeysiisyo",
    order_alerts: "Ogeysiisyada dalbiga & cusboonaysiinta xaalada",
    language: "Luqadda",
    language_preference: "Doorbidida Luqadda",
    privacy_security: "Amaanka & Sirta",
    terms_support: "Shuruudaha & Taageerada",
    log_out: "Ka Bax",
    delete_account: "Tirtir Akoonka",
    delete_confirm_title: "Ma rabtaa in aad tirtirto Akoonka PuntEats?",
    delete_confirm_msg: "Digniin: Ficilkan waa mid joogto ah. Dhammaan taariikhdaada dalbiga, ciwaannada, iyo xogta profile-ka way si buuxda u tirtirayaan.",
    yes_delete: "Haa, Dhamaan Tirtir",
    profile_updated: "Xogta Waa La Cusboonaysiiyay ✓",
    profile_saved: "Macluumaadkaaga shakhsiyeedka waa la keydsaday.",
    select_language: "Dooro Luqadda",
    choose_language: "Dooro luqadda aad dooranayso:",
    english: "Ingiriisi",
    somali: "Soomaali",
    logging_out: "Waxaa la baxayaa...",
    deleting_account: "Akoonka waxaa la tirtiraya...",

    // Wishlist
    wishlist: "Doonistooyinkayga",
    wishlist_empty: "Doonistooyinkaagu waa Madhan yahay",
    wishlist_empty_sub: "Baadhee makhaayadaha ugu wanaagsan oo halkan keydi cuntooyinkaaga jeceshahay.",

    // Checkout
    checkout: "Bixi",
    delivery: "Gaadhsiinta",
    payment: "Lacag Bixinta",
    confirm: "Xaqiiji",
    delivery_address: "Cinwaanka Gaadhsiinta",
    delivery_time: "Wakhtiga Gaadhsiinta",
    asap: "Sida ugu dhaqsaha badan",
    add_address: "Ku dar Cinwaan Cusub",
    address_title: "Cinwaanka Magaca",
    full_address: "Cinwaanka Buuxa",
    save_address: "Kaydi Cinwaanka",
    payment_method: "Habka Lacag Bixinta",
    cash_on_delivery: "Lacag Gaadhsiinta Markay Timaado",
    mobile_number: "Lambarka Mobilka",
    place_order: "Dir Dalabka",
    order_confirmed: "Dalabka Waa La Diray! ✓",
    order_confirmed_sub: "Dalabkaaga si guul leh ayaa loo diray.",
    confirm_order: "Xaqiiji Dalabka",
    items_in_order: "Badeecadaha dalabkan ku jira",
    empty_cart_msg: "Dambiilkaagu waa madhan yahay. Fadlan ku dar cuntooyinka marka hore.",
    invalid_phone: "Fadlan geli lambarka +252 Puntland ee sax ah.",
    next: "Xiga",
    back: "Dib u noqo",

    // Search
    search: "Raadi",
    search_results: "Natiijooyinka Raadinta",
    popular_food: "Cuntada Caanka ah",
    suggested_restaurants: "Makhaayadaha La Soo Jeediyay",
    recent_searches: "Raadintii Dhawaan",
    no_results: "Natiijo lama helin",
    no_results_sub: "Isku day erayo kale oo raadin",
    clear: "Nadiifi",

    // Restaurant Detail
    menu: "Menu",
    reviews: "Dhacdooyinka",
    info: "Macluumaadka",
    add_to_cart: "Ku dar Dambiilka",
    customise: "Habeyn",
    no_menu_items: "Cuntooyinka menu-ga ma jiraan",
    min_order: "Ugu yar. Dalabka",
    delivery_time_label: "Wakhtiga Gaadhsiinta",
    write_review: "Qor Dhacdada",
    all_reviews: "Dhammaan Dhacdooyinka",
    no_reviews: "Wali dhacdooyin kuma jiraan",
    in_stock: "Waa Jirtaa",
    out_of_stock: "Kuma Jirto",
    select_size: "Dooro Cabbirka",
    select_add_ons: "Dooro Kudaradaha",

    // General
    ok: "Hagaag",
    close: "Xir",
    loading: "La raraya...",
    retry: "Mar kale isku day",
    done: "Dhamaaday",
    version: "PuntEats v1.0.0 • Garoowe, Puntland",
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANG_STORAGE_KEY = "@puntgo_language";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("en");

  // Load saved language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANG_STORAGE_KEY).then(saved => {
      if (saved === "so" || saved === "en") setLangState(saved);
    }).catch(() => {});
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    AsyncStorage.setItem(LANG_STORAGE_KEY, newLang).catch(() => {});
  }, []);

  // Translation function — returns key string if translation missing (never crashes)
  const t = useCallback((key: string): string => {
    return translations[lang][key] ?? translations["en"][key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
